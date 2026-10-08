/**
 * Product Media Routes
 * Base path: /v1/seller/products (media endpoints)
 * All routes require SELLER role
 */
import { Router } from 'express';
import { productMediaController } from '../controllers/productMedia.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
const productMediaRouter = Router();
productMediaRouter.use(authenticate, authorize('SELLER'));
/**
 * POST /v1/seller/products/:id/media
 * Upload media to a product
 */
productMediaRouter.post('/:id/media', productMediaController.addMedia);
/**
 * PUT /v1/seller/products/media/:mediaId
 * Update media metadata
 */
productMediaRouter.put('/media/:mediaId', productMediaController.updateMedia);
/**
 * DELETE /v1/seller/products/media/:mediaId
 * Delete media
 */
productMediaRouter.delete('/media/:mediaId', productMediaController.deleteMedia);
export { productMediaRouter };
//# sourceMappingURL=product-media.routes.js.map