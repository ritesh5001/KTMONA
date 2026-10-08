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
     * List all active categories
     */
    listCategories = async (
        _req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const result = await this.service.listCategories();
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };
}

// Export singleton instance with default service
export const categoryController = new CategoryController(categoryService);
