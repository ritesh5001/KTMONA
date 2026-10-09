/**
 * Platform sale events (Meesho "Mega Blockbuster Sale" style). Sellers opt in
 * products at >= the event's minimum discount; each opt-in is a SellerOffer
 * tagged with the campaign, so the offer scheduler applies/reverts prices.
 */
type Phase = 'DRAFT' | 'CANCELLED' | 'UPCOMING' | 'LIVE' | 'ENDED';
export interface CampaignInput {
    name: string;
    description?: string | null | undefined;
    bannerImage?: string | null | undefined;
    startsAt: Date;
    endsAt: Date;
    joinDeadline?: Date | null | undefined;
    minDiscountPercent: number;
    categoryIds?: string[] | undefined;
}
declare class CampaignsService {
    private validate;
    private stats;
    adminList(): Promise<{
        campaigns: {
            sellers: number;
            products: number;
            variants: number;
            units: number;
            gmv: number;
            phase: Phase;
            status: import(".prisma/client").PlatformCampaignStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            slug: string;
            description: string | null;
            name: string;
            bannerImage: string | null;
            startsAt: Date;
            endsAt: Date;
            createdBy: string;
            joinDeadline: Date | null;
            minDiscountPercent: number;
            categoryIds: string[];
        }[];
    }>;
    create(adminId: string, input: CampaignInput): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        bannerImage: string | null;
        startsAt: Date;
        endsAt: Date;
        joinDeadline: Date | null;
        minDiscountPercent: number;
        categoryIds: string[];
        status: import(".prisma/client").PlatformCampaignStatus;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    update(id: string, input: Partial<CampaignInput> & {
        status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | undefined;
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        bannerImage: string | null;
        startsAt: Date;
        endsAt: Date;
        joinDeadline: Date | null;
        minDiscountPercent: number;
        categoryIds: string[];
        status: import(".prisma/client").PlatformCampaignStatus;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    sellerList(sellerId: string): Promise<{
        campaigns: {
            id: string;
            name: string;
            slug: string;
            description: string | null;
            bannerImage: string | null;
            startsAt: Date;
            endsAt: Date;
            joinDeadline: Date | null;
            minDiscountPercent: number;
            categories: {
                id: string;
                name: string;
            }[];
            phase: Phase;
            canJoin: boolean;
            participation: {
                offerId: string;
                discountPercent: number;
                products: number;
                status: import(".prisma/client").SellerOfferStatus;
            } | null;
        }[];
    }>;
    join(sellerId: string, campaignId: string, input: {
        productIds: string[];
        discountPercent: number;
    }): Promise<{
        joined: boolean;
        skippedVariants: number;
    }>;
    leave(sellerId: string, campaignId: string): Promise<{
        left: boolean;
    }>;
    publicList(): Promise<{
        live: boolean;
        name: string;
        slug: string;
        description: string | null;
        bannerImage: string | null;
        startsAt: Date;
        endsAt: Date;
        minDiscountPercent: number;
    }[]>;
    publicDetail(slug: string): Promise<{
        campaign: {
            name: string;
            slug: string;
            description: string | null;
            bannerImage: string | null;
            startsAt: Date;
            endsAt: Date;
            minDiscountPercent: number;
            phase: Phase;
        };
        products: {
            id: string;
            title: string;
            images: string[];
            category: {
                id: string;
                name: string;
            };
            price: number | null;
            compareAtPrice: number | null;
        }[];
    }>;
}
export declare const campaignsService: CampaignsService;
export {};
//# sourceMappingURL=campaigns.service.d.ts.map