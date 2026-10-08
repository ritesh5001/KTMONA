/**
 * Product Media Controller
 * HTTP handlers for product media management (seller endpoints)
 */

import type { Request, Response, NextFunction } from 'express';
import { productMediaService } from '../services/productMedia.service.js';
import { createMediaSchema, updateMediaSchema } from '../validators/media.validation.js';

export const productMediaController = {
    /**
     * POST /v1/seller/products/:id/media
     */
    addMedia: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const productId = req.params['id'] as string;
            const sellerId = req.user!.userId as string;
            const validated = createMediaSchema.parse(req.body);
            const media = await productMediaService.addMedia(productId, sellerId, validated);
            res.status(201).json({ message: 'Media added', media });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/seller/products/media/:mediaId
     */
    updateMedia: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const mediaId = req.params['mediaId'] as string;
            const sellerId = req.user!.userId as string;
            const validated = updateMediaSchema.parse(req.body);
            const media = await productMediaService.updateMedia(mediaId, sellerId, validated);
            res.json({ message: 'Media updated', media });
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /v1/seller/products/media/:mediaId
     */
    deleteMedia: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const mediaId = req.params['mediaId'] as string;
            const sellerId = req.user!.userId as string;
            await productMediaService.deleteMedia(mediaId, sellerId);
            res.json({ message: 'Media deleted' });
        } catch (error) {
            next(error);
        }
    },
};
