import { categoryService } from '../services/category.service.js';
/**
 * Category Controller
 * Handles HTTP layer for category endpoints
 */
export class CategoryController {
    service;
    constructor(service) {
        this.service = service;
    }
    /**
     * GET /v1/categories
     * List all active categories
     */
    listCategories = async (_req, res, next) => {
        try {
            const result = await this.service.listCategories();
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
}
// Export singleton instance with default service
export const categoryController = new CategoryController(categoryService);
//# sourceMappingURL=category.controller.js.map