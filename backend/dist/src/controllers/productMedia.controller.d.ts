/**
 * Product Media Controller
 * HTTP handlers for product media management (seller endpoints)
 */
import type { Request, Response, NextFunction } from 'express';
export declare const productMediaController: {
    /**
     * POST /v1/seller/products/:id/media
     */
    addMedia: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/seller/products/media/:mediaId
     */
    updateMedia: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /v1/seller/products/media/:mediaId
     */
    deleteMedia: (req: Request, res: Response, next: NextFunction) => Promise<void>;
};
//# sourceMappingURL=productMedia.controller.d.ts.map