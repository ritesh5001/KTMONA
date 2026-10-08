export declare class BestsellerRepository {
    /**
     * Admin bestseller list.
     *
     * One JOIN instead of nested includes: Prisma 4 would resolve
     * bestseller -> product -> category / seller as four separate statements, and
     * against a cross-region database each one is a full round-trip. That is absurd
     * for a list capped at four rows.
     *
     * The returned shape intentionally matches the nested version the service maps
     * over (`item.product.category.name` etc.) so callers are unaffected.
     */
    listAdmin(): Promise<{
        id: string;
        productId: string;
        position: number;
        product: {
            title: string;
            images: string[];
            isPublished: boolean;
            deletedByAdmin: boolean;
            category: {
                name: string;
            } | null;
            seller: {
                email: string;
            } | null;
        };
    }[]>;
    listPublic(limit: number, audience?: 'MENS' | 'KIDS'): Promise<({
        product: {
            variants: (import("@prisma/client/runtime/index.js").GetResult<{
                id: string;
                externalId: bigint | null;
                weightGrams: number | null;
                productId: string;
                size: string;
                color: string | null;
                colorHex: string | null;
                images: string[];
                sku: string;
                sellerPrice: number;
                adminListingPrice: number | null;
                price: number;
                compareAtPrice: number | null;
                status: import(".prisma/client").ProductStatus;
                rejectionReason: string | null;
                approvedAt: Date | null;
                approvedById: string | null;
                createdAt: Date;
                updatedAt: Date;
            }, unknown> & {})[];
            category: {
                name: string;
            };
        } & import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            externalId: bigint | null;
            slug: string | null;
            sellerId: string;
            categoryId: string;
            audience: import(".prisma/client").ProductAudience;
            title: string;
            description: string | null;
            sellerPrice: import("@prisma/client/runtime/index.js").Decimal;
            adminListingPrice: import("@prisma/client/runtime/index.js").Decimal | null;
            priceApprovedAt: Date | null;
            priceApprovedById: string | null;
            status: import(".prisma/client").ProductStatus;
            rejectionReason: string | null;
            approvedAt: Date | null;
            approvedById: string | null;
            isPublished: boolean;
            deletedByAdmin: boolean;
            deletedByAdminAt: Date | null;
            deletedByAdminReason: string | null;
            createdAt: Date;
            updatedAt: Date;
            taxRate: number;
            hsnCode: string | null;
            images: string[];
        }, unknown> & {};
    } & import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        productId: string;
        position: number;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {})[]>;
    findByProductId(productId: string): Promise<(import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        productId: string;
        position: number;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}) | null>;
    create(productId: string, position: number): Promise<import("@prisma/client/runtime/index.js").GetResult<{
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
    delete(id: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        productId: string;
        position: number;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    deleteByProductId(productId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    getMaxPosition(): Promise<number>;
    countAll(): Promise<number>;
}
export declare const bestsellerRepository: BestsellerRepository;
//# sourceMappingURL=bestseller.repository.d.ts.map