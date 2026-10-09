/**
 * Pricing & Offers: earnings calculator, price recommendations, instant price
 * cuts, and seller-funded discount offers.
 */
declare class SellerPricingService {
    calculator(sellerId: string, sellerPrice: number): Promise<{
        commissionPct: number;
        sellerPrice: number;
        commission: number;
        platformFee: number;
        net: number;
    }>;
    /** Category price benchmarks: median customer price of live variants. */
    private categoryMedians;
    list(sellerId: string, query: Record<string, unknown>): Promise<{
        commission: import("./common.js").CommissionTerms;
        variants: {
            variantId: string;
            productId: string;
            title: string;
            image: string | null;
            size: string;
            color: string | null;
            sku: string;
            status: import(".prisma/client").ProductStatus;
            stock: number;
            sellerPrice: number;
            customerPrice: number | null;
            mrp: number | null;
            earnings: {
                sellerPrice: number;
                commission: number;
                platformFee: number;
                net: number;
            };
            benchmark: number | null;
            competitive: boolean | null;
            recommendedSellerPrice: number | null;
            recommendedEarnings: number | null;
            offer: {
                id: string;
                name: string;
                discountPercent: number;
                status: import(".prisma/client").SellerOfferStatus;
                endsAt: Date;
            } | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Change a variant's seller price. Cuts go live instantly (the platform keeps
     * its rupee margin); increases go back to admin review like any variant edit.
     */
    updatePrice(sellerId: string, variantId: string, input: {
        sellerPrice?: number | undefined;
        mrp?: number | null | undefined;
    }): Promise<{
        result: "review" | "live" | "mrp";
        message: string;
    }>;
    listOffers(sellerId: string): Promise<{
        offers: {
            id: string;
            name: string;
            discountPercent: number;
            startsAt: Date;
            endsAt: Date;
            status: import(".prisma/client").SellerOfferStatus;
            variantCount: number;
            productCount: number;
            unitsSold: number;
            orders: number;
        }[];
    }>;
    createOffer(sellerId: string, input: {
        name: string;
        discountPercent: number;
        startsAt: Date;
        endsAt: Date;
        productIds: string[];
    }): Promise<{
        offer: {
            items: (import("@prisma/client/runtime/index.js").GetResult<{
                id: string;
                offerId: string;
                productId: string;
                variantId: string;
                originalPrice: number | null;
                originalSellerPrice: number | null;
                originalCompareAt: number | null;
                appliedPrice: number | null;
                appliedSellerPrice: number | null;
            }, unknown> & {})[];
        } & import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            name: string;
            discountPercent: number;
            startsAt: Date;
            endsAt: Date;
            status: import(".prisma/client").SellerOfferStatus;
            campaignId: string | null;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {};
        skippedVariants: number;
    }>;
    cancelOffer(sellerId: string, offerId: string): Promise<{
        ok: boolean;
    }>;
    /** Start due offers and end expired ones. Safe to run repeatedly. */
    runOfferSchedule(): Promise<{
        started: number;
        ended: number;
    }>;
    private applyOffer;
    private revertOffer;
}
export declare const sellerPricingService: SellerPricingService;
export {};
//# sourceMappingURL=pricing.service.d.ts.map