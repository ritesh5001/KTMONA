import type { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/category.service.js';
/**
 * Category Controller
 * Handles HTTP layer for category endpoints
 */
export declare class CategoryController {
    private readonly service;
    constructor(service: CategoryService);
    /**
     * GET /v1/categories
     * List all active categories
     */
    listCategories: (_req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const categoryController: CategoryController;
//# sourceMappingURL=category.controller.d.ts.map