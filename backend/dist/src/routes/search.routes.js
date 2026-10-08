import { Router } from 'express';
import { searchController } from '../controllers/search.controller.js';
/**
 * Search Routes
 * Base path: /v1/search
 * All routes are PUBLIC (no auth required)
 */
const searchRouter = Router();
/**
 * GET /v1/search
 * Full-text product search with sorting and pagination
 */
searchRouter.get('/', searchController.search);
/**
 * GET /v1/search/suggest
 * Autocomplete suggestions (ILIKE prefix match)
 */
searchRouter.get('/suggest', searchController.suggest);
/**
 * GET /v1/search/trending
 * Top trending search queries (Redis sorted set)
 */
searchRouter.get('/trending', searchController.trending);
export { searchRouter };
//# sourceMappingURL=search.routes.js.map