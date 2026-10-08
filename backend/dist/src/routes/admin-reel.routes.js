import { Router } from 'express';
import { reelController } from '../controllers/reel.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
/**
 * Admin Reel Routes
 * Base path: /v1/admin/reels
 * All routes require ADMIN or SUPER_ADMIN role
 */
const adminReelRouter = Router();
adminReelRouter.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));
/**
 * GET /v1/admin/reels
 * List all reels with filters
 */
adminReelRouter.get('/', reelController.listAdminReels);
/**
 * PATCH /v1/admin/reels/:id/approve
 * Approve a reel
 */
adminReelRouter.patch('/:id/approve', reelController.approveReel);
/**
 * PATCH /v1/admin/reels/:id/reject
 * Reject a reel
 */
adminReelRouter.patch('/:id/reject', reelController.rejectReel);
/**
 * DELETE /v1/admin/reels/:id
 * Delete a reel
 */
adminReelRouter.delete('/:id', reelController.deleteReelAdmin);
export { adminReelRouter };
//# sourceMappingURL=admin-reel.routes.js.map