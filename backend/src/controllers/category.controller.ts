import type { Request, Response, NextFunction } from 'express';
import { CategoryService, categoryService } from '../services/category.service.js';

/**
 * Category Controller
 * Handles HTTP layer for category endpoints
 */
export class CategoryController {
    constructor(private readonly service: CategoryService) { }

    /**
     * GET /v1/categories
     * List all active categories; `?visible=1` returns only categories with
     * live products, newest stock first (storefront menus and grids).
     * `?parentId=<id|root>`, `?q=<name>` and `?ids=a,b` browse the seller tree
     * one level at a time instead of loading all of it.
     */
    listCategories = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
            const { parentId, q, ids } = { parentId: str(req.query.parentId), q: str(req.query.q), ids: str(req.query.ids) };
            const result = parentId || q || ids
                ? await this.service.browse({ parentId, q, ids }, { scope: 'SELLER' })
                : req.query.visible === '1'
                    ? await this.service.listVisibleCategories()
                    : await this.service.listCategories();
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };
}

// Export singleton instance with default service
export const categoryController = new CategoryController(categoryService);
