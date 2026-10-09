/**
 * Seller catalog: listing tabs, pause/resume, holiday mode, inventory and
 * bulk catalog upload via an Excel template.
 */
export declare const CATALOG_TABS: readonly ["all", "live", "under_review", "rejected", "paused", "out_of_stock"];
export type CatalogTab = (typeof CATALOG_TABS)[number];
declare class SellerCatalogService {
    list(sellerId: string, query: Record<string, unknown>): Promise<{
        tab: "out_of_stock" | "all" | "live" | "under_review" | "rejected" | "paused";
        counts: Record<"out_of_stock" | "all" | "live" | "under_review" | "rejected" | "paused", number>;
        commission: import("./common.js").CommissionTerms;
        products: {
            id: string;
            title: string;
            image: string | null;
            category: {
                id: string;
                name: string;
            };
            status: string;
            rejectionReason: string | null;
            variantCount: number;
            priceMin: number | null;
            priceMax: number | null;
            sellerPriceMin: number;
            youEarnMin: number;
            stock: number;
            outOfStock: boolean;
            createdAt: Date;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    counts(sellerId: string): Promise<Record<CatalogTab, number>>;
    setPaused(sellerId: string, productIds: string[], paused: boolean): Promise<{
        updated: number;
    }>;
    /** Holiday mode pauses every live listing; turning it off resumes those. */
    setVacation(sellerId: string, on: boolean): Promise<{
        vacationMode: boolean;
    }>;
    inventory(sellerId: string, query: Record<string, unknown>): Promise<{
        summary: {
            totalVariants: number;
            outOfStock: number;
            lowStock: number;
            inStock: number;
            totalUnits: number;
        };
        lowStockThreshold: number;
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
            stockStatus: string;
            soldLast30Days: number;
            daysOfCover: number | null;
            updatedAt: Date | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    inventorySummary(sellerId: string): Promise<{
        totalVariants: number;
        outOfStock: number;
        lowStock: number;
        inStock: number;
        totalUnits: number;
    }>;
    bulkUpdateStock(sellerId: string, updates: {
        variantId: string;
        stock: number;
    }[]): Promise<{
        results: {
            variantId: string;
            ok: boolean;
            error?: string;
        }[];
        updated: number;
    }>;
    /** Inventory as an Excel sheet the seller can edit and upload back. */
    inventoryWorkbook(sellerId: string): Promise<Buffer>;
    importInventoryWorkbook(sellerId: string, file: Buffer): Promise<{
        results: {
            variantId: string;
            ok: boolean;
            error?: string;
        }[];
        updated: number;
    }>;
    catalogTemplate(categoryId: string): Promise<{
        file: Buffer;
        fileName: string;
    }>;
    importCatalog(sellerId: string, categoryId: string, file: Buffer): Promise<{
        productsCreated: number;
        products: {
            id: string;
            title: string;
        }[];
        rowsWithErrors: number;
        errors: {
            row: number;
            message: string;
        }[];
    }>;
}
export declare const sellerCatalogService: SellerCatalogService;
export {};
//# sourceMappingURL=catalog.service.d.ts.map