import { SellerSettlement } from '@prisma/client';
export declare class SettlementRepository {
    findSettlementsBySellerId(sellerId: string): Promise<SellerSettlement[]>;
    markSettlementAsSettled(settlementId: string): Promise<SellerSettlement>;
}
export declare const settlementRepository: SettlementRepository;
//# sourceMappingURL=settlement.repository.d.ts.map