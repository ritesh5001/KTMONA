/**
 * Seller payout runs: settlements due 7 days after delivery plus open ledger
 * entries (ads, penalties, claim credits), paid as one bank transfer per seller.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { PAYMENT_CYCLE_DAYS, addDays, parseLimit, parsePage, round2, sellerCode, toCsv } from '../seller-center/common.js';
import { storeNames } from './penalties.service.js';

interface DueSeller {
    sellerId: string;
    sellerCode: string;
    storeName: string | null;
    settlementIds: string[];
    settlementsAmount: number;
    ledgerIds: string[];
    ledgerAmount: number;
    amount: number;
    oldestDueDate: Date | null;
    onHold: boolean;
    holdReason: string | null;
    bank: { bankName: string; holderName: string; accountNumber: string; ifsc: string } | null;
}

class AdminPayoutsService {
    /** Everything payable right now, grouped by seller. */
    async due(opts: { includeNotDue?: boolean } = {}): Promise<DueSeller[]> {
        const cutoff = addDays(new Date(), -PAYMENT_CYCLE_DAYS);
        const settlements = await prisma.sellerSettlement.findMany({
            where: { status: { in: ['PENDING', 'SETTLED'] }, order: { status: { not: 'CANCELLED' } } },
            include: { order: { select: { shipments: { select: { seller_id: true, status: true, delivered_at: true } } } } },
        });
        const eligible = settlements.filter((s) => {
            const shipment = s.order.shipments.find((x) => x.seller_id === s.sellerId);
            if (!shipment || shipment.status !== 'DELIVERED' || !shipment.delivered_at) return false;
            return opts.includeNotDue || shipment.delivered_at <= cutoff;
        });
        const ledger = await prisma.sellerLedgerEntry.findMany({ where: { settledAt: null, waivedAt: null } });

        const sellerIds = [...new Set([...eligible.map((s) => s.sellerId), ...ledger.map((l) => l.sellerId)])];
        const [names, profiles] = await Promise.all([
            storeNames(sellerIds),
            prisma.seller_profiles.findMany({
                where: { user_id: { in: sellerIds } },
                select: { user_id: true, payout_hold: true, payout_hold_reason: true, seller_bank_accounts: { where: { is_primary: true }, take: 1 } },
            }),
        ]);
        const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

        return sellerIds
            .map((sellerId) => {
                const mine = eligible.filter((s) => s.sellerId === sellerId);
                const myLedger = ledger.filter((l) => l.sellerId === sellerId);
                const settlementsAmount = round2(mine.reduce((sum, s) => sum + s.netAmount, 0));
                const ledgerAmount = round2(myLedger.reduce((sum, l) => sum + l.amount, 0));
                const deliveredDates = mine
                    .map((s) => s.order.shipments.find((x) => x.seller_id === sellerId)?.delivered_at)
                    .filter((d): d is Date => Boolean(d))
                    .sort((a, b) => a.getTime() - b.getTime());
                const profile = profileMap.get(sellerId);
                const bank = profile?.seller_bank_accounts[0];
                return {
                    sellerId,
                    sellerCode: sellerCode(sellerId),
                    storeName: names.get(sellerId) ?? null,
                    settlementIds: mine.map((s) => s.id),
                    settlementsAmount,
                    ledgerIds: myLedger.map((l) => l.id),
                    ledgerAmount,
                    amount: round2(settlementsAmount + ledgerAmount),
                    oldestDueDate: deliveredDates[0] ? addDays(deliveredDates[0], PAYMENT_CYCLE_DAYS) : null,
                    onHold: profile?.payout_hold ?? false,
                    holdReason: profile?.payout_hold_reason ?? null,
                    bank: bank ? { bankName: bank.bank_name, holderName: bank.account_holder_name, accountNumber: bank.account_number, ifsc: bank.ifsc_code } : null,
                };
            })
            .filter((d) => d.settlementIds.length > 0 || d.ledgerIds.length > 0)
            .sort((a, b) => b.amount - a.amount);
    }

    async dueSummary() {
        const due = await this.due();
        const payable = due.filter((d) => !d.onHold && d.amount > 0 && d.bank);
        return {
            paymentCycleDays: PAYMENT_CYCLE_DAYS,
            totals: {
                payableAmount: round2(payable.reduce((s, d) => s + d.amount, 0)),
                payableSellers: payable.length,
                onHoldAmount: round2(due.filter((d) => d.onHold).reduce((s, d) => s + d.amount, 0)),
                missingBank: due.filter((d) => !d.bank && d.amount > 0).length,
                negativeBalances: due.filter((d) => d.amount <= 0).length,
            },
            sellers: due.map((d) => ({
                ...d,
                bank: d.bank ? { ...d.bank, accountNumber: `••••${d.bank.accountNumber.slice(-4)}` } : null,
                status: d.onHold ? 'ON_HOLD' : !d.bank ? 'NO_BANK' : d.amount <= 0 ? 'CARRY_FORWARD' : 'PAYABLE',
            })),
        };
    }

    /** Mark one seller's due balance as paid (after the bank transfer is made). */
    async pay(adminId: string, sellerId: string, input: { reference: string; method?: string | undefined; note?: string | undefined; expectedAmount?: number | undefined }) {
        const due = (await this.due()).find((d) => d.sellerId === sellerId);
        if (!due) throw ApiError.badRequest('Nothing is due for this seller');
        if (due.onHold) throw ApiError.badRequest(`Payouts are on hold: ${due.holdReason ?? 'no reason given'}`);
        if (due.amount <= 0) throw ApiError.badRequest('Balance is zero or negative; it carries forward to the next cycle');
        if (input.expectedAmount !== undefined && Math.abs(input.expectedAmount - due.amount) > 0.01) {
            throw ApiError.conflict(`The amount changed to Rs. ${due.amount}. Refresh and confirm again.`);
        }

        const payoutNumber = `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const now = new Date();
        return prisma.$transaction(async (tx) => {
            const payout = await tx.sellerPayout.create({
                data: {
                    payoutNumber,
                    sellerId,
                    amount: due.amount,
                    settlementsAmount: due.settlementsAmount,
                    ledgerAmount: due.ledgerAmount,
                    settlementCount: due.settlementIds.length,
                    ledgerCount: due.ledgerIds.length,
                    method: input.method ?? 'BANK_TRANSFER',
                    reference: input.reference,
                    note: input.note ?? null,
                    ...(due.bank ? { bankSnapshot: due.bank as unknown as Prisma.InputJsonValue } : {}),
                    createdBy: adminId,
                },
            });
            await tx.sellerSettlement.updateMany({ where: { id: { in: due.settlementIds } }, data: { status: 'PAID', settledAt: now, payoutId: payout.id } });
            await tx.sellerLedgerEntry.updateMany({ where: { id: { in: due.ledgerIds } }, data: { settledAt: now, payoutId: payout.id } });
            return payout;
        });
    }

    async history(query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 30);
        const where: Prisma.SellerPayoutWhereInput = typeof query.sellerId === 'string' ? { sellerId: query.sellerId } : {};
        const [total, payouts, agg] = await Promise.all([
            prisma.sellerPayout.count({ where }),
            prisma.sellerPayout.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
            prisma.sellerPayout.aggregate({ where, _sum: { amount: true } }),
        ]);
        const names = await storeNames(payouts.map((p) => p.sellerId));
        return {
            totalPaid: round2(agg._sum.amount ?? 0),
            payouts: payouts.map((p) => ({ ...p, storeName: names.get(p.sellerId) ?? null })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    /** Bulk bank-transfer sheet for everything payable now. */
    async bankFileCsv(): Promise<string> {
        const due = (await this.due()).filter((d) => !d.onHold && d.amount > 0 && d.bank);
        return toCsv(
            ['Seller ID', 'Store', 'Account holder', 'Account number', 'IFSC', 'Bank', 'Amount (Rs)', 'Narration'],
            due.map((d) => [d.sellerCode, d.storeName ?? '', d.bank!.holderName, d.bank!.accountNumber, d.bank!.ifsc, d.bank!.bankName, d.amount, `KTMONA payout ${d.sellerCode}`])
        );
    }
}

export const adminPayoutsService = new AdminPayoutsService();
