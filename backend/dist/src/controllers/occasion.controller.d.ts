import type { Request, Response, NextFunction } from 'express';
import { OccasionService } from '../services/occasion.service.js';
/**
 * Occasion Controller
 * Handles HTTP layer for occasion endpoints
 */
export declare class OccasionController {
    private readonly service;
    constructor(service: OccasionService);
    /**
     * GET /v1/occasions
     * List all active occasions
     */
    listOccasions: (_req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /v1/admin/occasions
     * List all occasions (admin)
     */
    listAllOccasions: (_req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/admin/occasions
     * Create occasion
     */
    createOccasion: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/admin/occasions/:id
     * Update occasion
     */
    updateOccasion: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /v1/admin/occasions/:id
     * Delete occasion
     */
    deleteOccasion: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PATCH /v1/admin/occasions/:id/toggle
     * Toggle occasion active state
     */
    toggleOccasion: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const occasionController: OccasionController;
//# sourceMappingURL=occasion.controller.d.ts.map