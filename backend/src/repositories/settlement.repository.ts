
import { prisma } from '../config/db.js';
import { SellerSettlement, SettlementStatus } from '@prisma/client';

export class SettlementRepository {

    async findSettlementsBySellerId(sellerId: string): Promise<SellerSettlement[]> {
        return prisma.sellerSettlement.findMany({
            where: { sellerId },
            include: {
                order: { select: { id: true, totalAmount: true, status: true, invoiceNumber: true } },
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 500,
        });
    }

    async markSettlementAsSettled(settlementId: string): Promise<SellerSettlement> {
        return prisma.sellerSettlement.update({
            where: { id: settlementId },
            data: {
                status: SettlementStatus.SETTLED,
                settledAt: new Date(),
            }
        });
    }
}

export const settlementRepository = new SettlementRepository();
