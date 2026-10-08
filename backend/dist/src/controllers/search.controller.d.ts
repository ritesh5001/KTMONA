import type { Request, Response, NextFunction } from 'express';
export declare class SearchController {
    /**
     * GET /v1/search?q=...&page=&limit=&categoryId=&sort=
     */
    search: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /v1/search/suggest?q=...&limit=
     */
    suggest: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /v1/search/trending?limit=
     */
    trending: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /v1/products/:id/related?limit=
     */
    relatedProducts: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const searchController: SearchController;
//# sourceMappingURL=search.controller.d.ts.map