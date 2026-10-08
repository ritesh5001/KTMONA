/**
 * Seller settings: store profile, business/GST details, pickup address,
 * bank account for payouts and holiday mode.
 */

import { BusinessType } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../errors/ApiError.js';
import { invalidateSellerPrivateCaches } from '../../utils/cache.util.js';
import { sellerCode } from './common.js';
import { isShiprocketShippingEnabled, upsertPickupLocation } from './shiprocket-shipping.client.js';
import { sellerCatalogService } from './catalog.service.js';

const log = logger.child({ module: 'seller-settings' });

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;

function slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'store';
}

function maskAccount(n: string): string {
    return n.length <= 4 ? n : `${'•'.repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`;
}

class SellerSettingsService {
    async get(sellerId: string) {
        const [user, profile] = await Promise.all([
            prisma.user.findUnique({ where: { id: sellerId }, select: { email: true, phone: true, whatsappNumber: true, status: true, createdAt: true } }),
            prisma.seller_profiles.findUnique({ where: { user_id: sellerId }, include: { seller_bank_accounts: true } }),
        ]);
        if (!user) throw ApiError.notFound('Seller not found');
        return {
            sellerCode: sellerCode(sellerId),
            account: { email: user.email, phone: user.phone, whatsapp: user.whatsappNumber, status: user.status, joinedAt: user.createdAt },
            store: profile && {
                name: profile.store_name,
                slug: profile.store_slug,
                description: profile.store_description,
                logo: profile.store_logo,
                supportEmail: profile.support_email,
                supportPhone: profile.support_phone,
                vacationMode: profile.vacation_mode,
            },
            business: profile && {
                businessType: profile.business_type,
                gstRegistered: profile.gst_registered,
                gstin: profile.gstin ?? profile.gst_number,
                enrolmentId: profile.enrolment_id,
                pan: profile.pan_number,
                state: profile.state,
                kycStatus: profile.kyc_status,
            },
            pickup: profile && {
                contactName: profile.pickup_contact_name,
                phone: profile.pickup_phone,
                line1: profile.pickup_address_line1,
                line2: profile.pickup_address_line2,
                city: profile.pickup_city,
                state: profile.pickup_state,
                pincode: profile.pickup_pincode,
            },
            bankAccounts: (profile?.seller_bank_accounts ?? []).map((b) => ({
                id: b.id,
                bankName: b.bank_name,
                holderName: b.account_holder_name,
                accountNumberMasked: maskAccount(b.account_number),
                ifsc: b.ifsc_code,
                isPrimary: b.is_primary,
            })),
            shipping: { mode: isShiprocketShippingEnabled() ? 'SHIPROCKET' : 'SELF_SHIP' },
        };
    }

    async storeNameAvailable(name: string, sellerId?: string) {
        const slug = slugify(name);
        const existing = await prisma.seller_profiles.findFirst({
            where: { OR: [{ store_slug: slug }, { store_name: { equals: name.trim(), mode: 'insensitive' } }] },
            select: { user_id: true },
        });
        return { name: name.trim(), slug, available: !existing || existing.user_id === sellerId };
    }

    /** Create the profile on first save; later saves update it. */
    private async ensureProfile(sellerId: string, storeName?: string) {
        const existing = await prisma.seller_profiles.findUnique({ where: { user_id: sellerId } });
        if (existing) return existing;
        if (!storeName) throw ApiError.badRequest('Set your store name first');
        const check = await this.storeNameAvailable(storeName, sellerId);
        if (!check.available) throw ApiError.conflict('This store name is taken');
        return prisma.seller_profiles.create({
            data: { user_id: sellerId, store_name: storeName.trim(), store_slug: check.slug, business_type: 'INDIVIDUAL', updated_at: new Date() },
        });
    }

    async updateStore(sellerId: string, input: { name: string; description?: string | null | undefined; logo?: string | null | undefined; supportEmail?: string | null | undefined; supportPhone?: string | null | undefined}) {
        if (input.name.trim().length < 3) throw ApiError.badRequest('Store name must be at least 3 characters');
        await this.ensureProfile(sellerId, input.name);
        const check = await this.storeNameAvailable(input.name, sellerId);
        if (!check.available) throw ApiError.conflict('This store name is taken');
        await prisma.seller_profiles.update({
            where: { user_id: sellerId },
            data: {
                store_name: input.name.trim(),
                store_slug: check.slug,
                store_description: input.description ?? null,
                store_logo: input.logo ?? null,
                support_email: input.supportEmail ?? null,
                support_phone: input.supportPhone ?? null,
                updated_at: new Date(),
            },
        });
        await invalidateSellerPrivateCaches(sellerId);
        return this.get(sellerId);
    }

    async updateBusiness(sellerId: string, input: { businessType: BusinessType; gstRegistered: boolean; gstin?: string | null | undefined; enrolmentId?: string | null | undefined; pan: string; state: string }) {
        await this.ensureProfile(sellerId);
        const pan = input.pan.trim().toUpperCase();
        if (!PAN_RE.test(pan)) throw ApiError.badRequest('Enter a valid PAN, e.g. ABCDE1234F');
        let gstin: string | null = null;
        if (input.gstRegistered) {
            gstin = (input.gstin ?? '').trim().toUpperCase();
            if (!GSTIN_RE.test(gstin)) throw ApiError.badRequest('Enter a valid 15-character GSTIN');
            if (gstin.slice(2, 12) !== pan) throw ApiError.badRequest('The PAN inside your GSTIN does not match your PAN');
        } else if (!input.enrolmentId?.trim()) {
            throw ApiError.badRequest('Non-GST sellers need a GST enrolment ID (or UIN)');
        }
        await prisma.seller_profiles.update({
            where: { user_id: sellerId },
            data: {
                business_type: input.businessType,
                gst_registered: input.gstRegistered,
                gstin,
                gst_number: gstin,
                enrolment_id: input.gstRegistered ? null : input.enrolmentId!.trim(),
                pan_number: pan,
                state: input.state.trim(),
                kyc_status: 'PENDING',
                updated_at: new Date(),
            },
        });
        return this.get(sellerId);
    }

    async updatePickup(sellerId: string, input: { contactName: string; phone: string; line1: string; line2?: string | null | undefined; city: string; state: string; pincode: string }) {
        const profile = await this.ensureProfile(sellerId);
        if (!PINCODE_RE.test(input.pincode.trim())) throw ApiError.badRequest('Enter a valid 6-digit pincode');
        if (!/^[6-9][0-9]{9}$/.test(input.phone.replace(/\D/g, '').slice(-10))) throw ApiError.badRequest('Enter a valid 10-digit mobile number');
        await prisma.seller_profiles.update({
            where: { user_id: sellerId },
            data: {
                pickup_contact_name: input.contactName.trim(),
                pickup_phone: input.phone.replace(/\D/g, '').slice(-10),
                pickup_address_line1: input.line1.trim(),
                pickup_address_line2: input.line2?.trim() || null,
                pickup_city: input.city.trim(),
                pickup_state: input.state.trim(),
                pickup_pincode: input.pincode.trim(),
                updated_at: new Date(),
            },
        });
        if (isShiprocketShippingEnabled()) {
            const user = await prisma.user.findUnique({ where: { id: sellerId }, select: { email: true } });
            try {
                await upsertPickupLocation({
                    name: sellerCode(sellerId),
                    contactName: input.contactName,
                    email: profile.support_email ?? user?.email ?? 'seller@ktmona.com',
                    phone: input.phone.replace(/\D/g, '').slice(-10),
                    address: input.line1,
                    address2: input.line2 ?? null,
                    city: input.city,
                    state: input.state,
                    pincode: input.pincode,
                });
            } catch (err) {
                log.warn({ err, sellerId }, 'Could not register pickup address with Shiprocket');
            }
        }
        return this.get(sellerId);
    }

    async upsertBank(sellerId: string, input: { bankName: string; holderName: string; accountNumber: string; ifsc: string }) {
        await this.ensureProfile(sellerId);
        const ifsc = input.ifsc.trim().toUpperCase();
        const account = input.accountNumber.replace(/\s/g, '');
        if (!IFSC_RE.test(ifsc)) throw ApiError.badRequest('Enter a valid IFSC code, e.g. HDFC0001234');
        if (!/^[0-9]{9,18}$/.test(account)) throw ApiError.badRequest('Account number must be 9–18 digits');
        await prisma.$transaction(async (tx) => {
            await tx.seller_bank_accounts.updateMany({ where: { seller_id: sellerId }, data: { is_primary: false, updated_at: new Date() } });
            await tx.seller_bank_accounts.create({
                data: {
                    id: `bank_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    seller_id: sellerId,
                    bank_name: input.bankName.trim(),
                    account_holder_name: input.holderName.trim(),
                    account_number: account,
                    ifsc_code: ifsc,
                    is_primary: true,
                    updated_at: new Date(),
                },
            });
        });
        return this.get(sellerId);
    }

    async setVacation(sellerId: string, on: boolean) {
        await this.ensureProfile(sellerId);
        await sellerCatalogService.setVacation(sellerId, on);
        return this.get(sellerId);
    }
}

export const sellerSettingsService = new SellerSettingsService();
