/**
 * Catalog QC: review queue with automatic checks and bulk approve/reject.
 */
export declare const QC_REASONS: readonly ["Blurry or low-quality images", "Image does not match the product", "Watermark, logo or text on images", "Wrong category", "Incomplete or misleading title/description", "Size or colour variants are incorrect", "Price looks incorrect", "MRP is inflated", "Duplicate listing", "Prohibited or restricted product", "Brand / trademark violation"];
declare class AdminQcService {
    queue(query: Record<string, unknown>): Promise<{
        reasons: readonly ["Blurry or low-quality images", "Image does not match the product", "Watermark, logo or text on images", "Wrong category", "Incomplete or misleading title/description", "Size or colour variants are incorrect", "Price looks incorrect", "MRP is inflated", "Duplicate listing", "Prohibited or restricted product", "Brand / trademark violation"];
        products: {
            id: string;
            title: string;
            description: string | null;
            images: string[];
            category: {
                id: string;
                name: string;
            };
            seller: {
                id: string;
                code: string;
                storeName: string | null;
            };
            submittedAt: Date;
            isEdit: boolean;
            hsnCode: string | null;
            taxRate: number;
            variants: {
                id: string;
                size: string;
                color: string | null;
                sku: string;
                sellerPrice: number;
                mrp: number | null;
                stock: number;
                status: import(".prisma/client").ProductStatus;
            }[];
            pendingVariants: number;
            categoryMedianPrice: number | null;
            flags: {
                level: "error" | "warning";
                text: string;
            }[];
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    bulkReview(adminId: string, input: {
        productIds: string[];
        action: 'APPROVE' | 'REJECT';
        reason?: string | undefined;
    }): Promise<{
        results: {
            productId: string;
            ok: boolean;
            error?: string;
        }[];
        done: number;
    }>;
}
export declare const adminQcService: AdminQcService;
export {};
//# sourceMappingURL=qc.service.d.ts.map