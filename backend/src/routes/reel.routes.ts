import { Router } from 'express';
import { reelController } from '../controllers/reel.controller.js';
import { reelEngagementController } from '../controllers/reel-engagement.controller.js';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.js';

/**
 * Public Reel Routes
 * Base path: /v1/reels
 */
const reelRouter = Router();

/**
 * GET /v1/reels
 * List approved reels with pagination
 */
reelRouter.get('/', reelController.listPublicReels);

/**
 * GET /v1/reels/:id
 * Get a single approved reel by ID
 */
reelRouter.get('/:id', reelController.getPublicReel);

// =========================================================================
// ENGAGEMENT ROUTES
// =========================================================================

/**
 * POST /v1/reels/:id/like
 * Like a reel (authenticated)
 */
reelRouter.post('/:id/like', authenticate, reelEngagementController.likeReel);

/**
 * DELETE /v1/reels/:id/like
 * Unlike a reel (authenticated)
 */
reelRouter.delete('/:id/like', authenticate, reelEngagementController.unlikeReel);

/**
 * GET /v1/reels/:id/like
 * Check if user has liked a reel (authenticated)
 */
reelRouter.get('/:id/like', authenticate, reelEngagementController.checkLiked);

/**
 * POST /v1/reels/:id/view
 * Record a view (public, optional auth for spam prevention)
 */
reelRouter.post('/:id/view', optionalAuthenticate, reelEngagementController.recordView);

/**
 * POST /v1/reels/:id/product-click
 * Record a product click (public, optional auth)
 */
reelRouter.post('/:id/product-click', optionalAuthenticate, reelEngagementController.recordProductClick);

export { reelRouter };
