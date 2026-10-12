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
     */
    listCategories = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const result = req.query.visible === '1'
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
