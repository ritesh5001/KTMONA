export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popularity';
export interface SearchFilters {
    q: string;
    page: number;
    limit: number;
    categoryId?: string | undefined;
    sort?: SortOption;
}
export interface SearchResultItem {
    id: string;
    title: string;
    description: string | null;
    images: string[];
    categoryId: string;
    adminListingPrice: number | null;
    isPublished: boolean;
    createdAt: string;
    category: {
        id: string;
        name: string;
    } | null;
    rank?: number;
}
export interface SearchResponse {
    data: SearchResultItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface SuggestionItem {
    id: string;
    title: string;
    category?: string | null;
}
export interface RelatedProductItem {
    id: string;
    title: string;
    description: string | null;
    images: string[];
    categoryId: string;
    adminListingPrice: number | null;
    category: {
        id: string;
        name: string;
    } | null;
}
export declare class SearchService {
    private normalizeQuery;
    searchProducts(filters: SearchFilters): Promise<SearchResponse>;
    getSuggestions(q: string, limit?: number): Promise<SuggestionItem[]>;
    private trackTrending;
    getTrending(limit?: number): Promise<string[]>;
    getRelatedProducts(productId: string, limit?: number): Promise<RelatedProductItem[]>;
}
export declare const searchService: SearchService;
//# sourceMappingURL=search.service.d.ts.map