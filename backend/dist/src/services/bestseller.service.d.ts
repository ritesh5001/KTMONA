export declare class BestsellerService {
    private toNumber;
    private roundMoney;
    private calculateDiscountedPrice;
    private getBestCouponPreview;
    private resolveCheapestVariant;
    private getActiveCouponsForSellers;
    listPublic(limit?: number, audience?: 'MENS' | 'KIDS'): Promise<any>;
    listAdmin(): Promise<{
        bestsellers: {
            id: string;
            productId: string;
            position: number;
            title: string;
            categoryName: string | null;
            sellerEmail: string | null;
            isPublished: boolean;
            deletedByAdmin: boolean;
            image: string | null;
        }[];
    }>;
    add(productId: string, position?: number): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        productId: string;
        position: number;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    update(id: string, position: number): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        productId: string;
        position: number;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    remove(id: string): Promise<void>;
    removeByProductId(productId: string): Promise<void>;
}
export declare const bestsellerService: BestsellerService;
//# sourceMappingURL=bestseller.service.d.ts.map