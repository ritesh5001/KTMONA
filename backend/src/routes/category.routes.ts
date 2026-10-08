import { Router } from 'express';
import { categoryController } from '../controllers/category.controller.js';

/**
 * Category Routes
 * Base path: /v1/categories
 * All routes are PUBLIC (no auth required)
 */
const categoryRouter = Router();

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /v1/categories
 * List all active categories
 */
categoryRouter.get('/', categoryController.listCategories);

export { categoryRouter };
