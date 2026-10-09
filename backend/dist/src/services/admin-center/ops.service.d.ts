/**
 * Admin operations dashboard, ads oversight and seller announcements.
 */
import { AnnouncementLevel } from '@prisma/client';
declare class AdminOpsService {
    dashboard(rangeDays?: number): Promise<{
        rangeDays: number;
        kpis: {
            gmv: {
                value: number;
                change: number | null;
            };
            orders: {
                value: number;
                change: number | null;
            };
            aov: number;
            platformRevenue: number;
            commission: number;
            adRevenue: number;
            activeSellers: number;
            liveProducts: number;
        };
        series: {
            date: string;
            gmv: number;
            orders: number;
        }[];
        actionCenter: {
            key: string;
            label: string;
            count: number;
            href: string;
        }[];
        payoutsDue: {
            payableAmount: number;
            payableSellers: number;
            onHoldAmount: number;
            missingBank: number;
            negativeBalances: number;
        };
        sellerCounts: {
            [k: string]: number;
        };
        topSellers: {
            sellerId: string;
            code: string;
            storeName: string | null;
            orders: number;
            gmv: number;
        }[];
        topCategories: {
            name: string;
            units: number;
            gmv: number;
        }[];
        recentOrders: {
            id: string;
            createdAt: Date;
            status: import(".prisma/client").OrderStatus;
            amount: number;
            customer: string | null;
            city: string | null;
            sellers: string[];
        }[];
    }>;
    ads(days?: number): Promise<{
        days: number;
        totals: {
            activeCampaigns: number;
            impressions: number;
            clicks: number;
            spend: number;
            orders: number;
            revenue: number;
        };
        campaigns: {
            spend: number;
            revenue: number;
            impressions: number;
            clicks: number;
            orders: number;
            id: string;
            name: string;
            status: import(".prisma/client").AdCampaignStatus;
            sellerId: string;
            storeName: string | null;
            dailyBudget: number;
            bidPerClick: number;
            products: number;
        }[];
    }>;
    setAdStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'ENDED'): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        sellerId: string;
        name: string;
        dailyBudget: number;
        bidPerClick: number;
        startsAt: Date;
        endsAt: Date | null;
        status: import(".prisma/client").AdCampaignStatus;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    listAnnouncements(): Promise<{
        announcements: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            title: string;
            body: string;
            level: AnnouncementLevel;
            linkUrl: string | null;
            linkLabel: string | null;
            startsAt: Date;
            endsAt: Date | null;
            isActive: boolean;
            createdBy: string;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {})[];
    }>;
    saveAnnouncement(adminId: string, id: string | null, input: {
        title: string;
        body: string;
        level: AnnouncementLevel;
        linkUrl?: string | null | undefined;
        linkLabel?: string | null | undefined;
        startsAt?: Date | undefined;
        endsAt?: Date | null | undefined;
        isActive?: boolean | undefined;
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        title: string;
        body: string;
        level: AnnouncementLevel;
        linkUrl: string | null;
        linkLabel: string | null;
        startsAt: Date;
        endsAt: Date | null;
        isActive: boolean;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    deleteAnnouncement(id: string): Promise<{
        deleted: boolean;
    }>;
    /** Live announcements for the seller dashboard. */
    activeAnnouncements(): Promise<(import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        title: string;
        body: string;
        level: AnnouncementLevel;
        linkUrl: string | null;
        linkLabel: string | null;
        startsAt: Date;
        endsAt: Date | null;
        isActive: boolean;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {})[]>;
}
export declare const adminOpsService: AdminOpsService;
export {};
//# sourceMappingURL=ops.service.d.ts.map