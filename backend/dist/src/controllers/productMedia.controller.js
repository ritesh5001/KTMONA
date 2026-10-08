/**
 * Product Media Controller
 * HTTP handlers for product media management (seller endpoints)
 */
import { productMediaService } from '../services/productMedia.service.js';
import { createMediaSchema, updateMediaSchema } from '../validators/media.validation.js';
export const productMediaController = {
    /**
     * POST /v1/seller/products/:id/media
     */
    addMedia: async (req, res, next) => {
        try {
            const productId = req.params['id'];
            const sellerId = req.user.userId;
            const validated = createMediaSchema.parse(req.body);
            const media = await productMediaService.addMedia(productId, sellerId, validated);
            res.status(201).json({ message: 'Media added', media });
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * PUT /v1/seller/products/media/:mediaId
     */
    updateMedia: async (req, res, next) => {
        try {
            const mediaId = req.params['mediaId'];
            const sellerId = req.user.userId;
            const validated = updateMediaSchema.parse(req.body);
            const media = await productMediaService.updateMedia(mediaId, sellerId, validated);
            res.json({ message: 'Media updated', media });
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * DELETE /v1/seller/products/media/:mediaId
     */
    deleteMedia: async (req, res, next) => {
        try {
            const mediaId = req.params['mediaId'];
            const sellerId = req.user.userId;
            await productMediaService.deleteMedia(mediaId, sellerId);
            res.json({ message: 'Media deleted' });
        }
        catch (error) {
            next(error);
        }
    },
};
//# sourceMappingURL=productMedia.controller.js.map