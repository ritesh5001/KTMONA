export declare const SHIPROCKET_MAX_LIMIT = 250;
export declare const SHIPROCKET_DEFAULT_LIMIT = 100;
export interface CatalogPageQuery {
    page: number;
    limit: number;
    collectionId?: string | undefined;
}
interface ShiprocketImage {
    src: string;
}
interface ShiprocketVariant {
    id: number;
    title: string;
    price: string;
    compare_at_price: string | null;
    sku: string;
    quantity: number;
    created_at: string;
    updated_at: string;
    taxable: boolean;
    option_values: Record<string, string>;
    grams: number;
    weight: number;
    weight_unit: string;
    image: ShiprocketImage | null;
}
interface ShiprocketProduct {
    id: number;
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    created_at: string;
    handle: string;
    updated_at: string;
    tags: string;
    status: string;
    variants: ShiprocketVariant[];
    image: ShiprocketImage | null;
    options: Array<{
        name: string;
        values: string[];
    }>;
}
interface ShiprocketCollection {
    id: number;
    updated_at: string;
    body_html: string;
    handle: string;
    image: ShiprocketImage | null;
    title: string;
    created_at: string;
}
export declare function slugify(value: string): string;
export declare class ShiprocketCatalogService {
    /**
     * Products with their variants, optionally scoped to one collection.
     *
     * `collectionId` accepts either the numeric `external_id` Shiprocket holds or
     * the internal CUID, so the endpoint keeps working if anyone tests it with a
     * category id copied out of the admin panel.
     */
    listProducts(query: CatalogPageQuery): Promise<{
        data: {
            total: number;
            products: ShiprocketProduct[];
        };
    }>;
    listCollections(query: Omit<CatalogPageQuery, 'collectionId'>): Promise<{
        data: {
            total: number;
            collections: ShiprocketCollection[];
        };
    }>;
    private resolveCategoryId;
    private toShiprocketProduct;
}
export declare const shiprocketCatalogService: ShiprocketCatalogService;
export {};
//# sourceMappingURL=shiprocket-catalog.service.d.ts.map