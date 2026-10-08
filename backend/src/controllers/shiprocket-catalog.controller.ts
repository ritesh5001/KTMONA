import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    shiprocketCatalogService,
    SHIPROCKET_DEFAULT_LIMIT,
    SHIPROCKET_MAX_LIMIT,
} from '../services/shiprocket-catalog.service.js';

/**
 * Shiprocket Catalog Controller
 *
 * Serves the three endpoints Shiprocket Checkout (Fastrr) polls. Public by
 * default because their documented requests carry no auth header; set
 * SHIPROCKET_API_KEY to require one (see the route file).
 */
const catalogQuerySchema = z.object({
    page: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1))
        .optional()
        .default('1'),

    // Shiprocket asks for 100 at a time — well above the public catalog's cap of 20.
    limit: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1).max(SHIPROCKET_MAX_LIMIT))
        .optional()
        .default(String(SHIPROCKET_DEFAULT_LIMIT)),

    collection_id: z.string().min(1).optional(),
});

export class ShiprocketCatalogController {
    /**
     * GET /v1/shiprocket/products
     * GET /v1/shiprocket/products?collection_id=123
     *
     * One handler for both of Shiprocket's product endpoints — their own example
     * uses the same path, with the collection filter as a query parameter.
     */
    listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { page, limit, collection_id } = catalogQuerySchema.parse(req.query);
            const payload = await shiprocketCatalogService.listProducts({
                page,
                limit,
                collectionId: collection_id,
            });
            res.json(payload);
        } catch (error) {
            next(error);
        }
    };

    /** GET /v1/shiprocket/collections */
    listCollections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { page, limit } = catalogQuerySchema.parse(req.query);
            const payload = await shiprocketCatalogService.listCollections({ page, limit });
            res.json(payload);
        } catch (error) {
            next(error);
        }
    };
}

export const shiprocketCatalogController = new ShiprocketCatalogController();
