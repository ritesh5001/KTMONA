import { Router } from 'express';
import { reelController } from '../controllers/reel.controller.js';
import { reelEngagementController } from '../controllers/reel-engagement.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

/**
 * Seller Reel Routes
 * Base path: /v1/seller/reels
 * All routes require SELLER role
 */
const sellerReelRouter = Router();

sellerReelRouter.use(authenticate, authorize('SELLER'));

/**
 * POST /v1/seller/reels
 * Create a new reel
 */
sellerReelRouter.post('/', reelController.createReel);

/**
 * GET /v1/seller/reels
 * List seller's own reels
 */
sellerReelRouter.get('/', reelController.listSellerReels);

/**
 * PATCH /v1/seller/reels/:id
 * Update a reel
 */
sellerReelRouter.patch('/:id', reelController.updateSellerReel);

/**
 * GET /v1/seller/reels/analytics
 * Get seller reel analytics (views, likes, product clicks)
 */
sellerReelRouter.get('/analytics', reelEngagementController.getSellerAnalytics);

/**
 * DELETE /v1/seller/reels/:id
 * Delete a reel
 */
sellerReelRouter.delete('/:id', reelController.deleteSellerReel);

export { sellerReelRouter };
