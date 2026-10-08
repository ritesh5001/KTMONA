import type { Request, Response, NextFunction } from 'express';
import { OccasionService, occasionService } from '../services/occasion.service.js';
import { createOccasionSchema, updateOccasionSchema } from '../validators/occasion.validation.js';

/**
 * Occasion Controller
 * Handles HTTP layer for occasion endpoints
 */
export class OccasionController {
    constructor(private readonly service: OccasionService) {}

    // =========================================================================
    // PUBLIC
    // =========================================================================

    /**
     * GET /v1/occasions
     * List all active occasions
     */
    listOccasions = async (
        _req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const result = await this.service.listOccasions();
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    // =========================================================================
    // ADMIN
    // =========================================================================

    /**
     * GET /v1/admin/occasions
     * List all occasions (admin)
     */
    listAllOccasions = async (
        _req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const result = await this.service.listAllOccasions();
            res.json(result);
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /v1/admin/occasions
     * Create occasion
     */
    createOccasion = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const validated = createOccasionSchema.parse(req.body);
            const occasion = await this.service.createOccasion(validated);
            res.status(201).json({ message: 'Occasion created', occasion });
        } catch (error) {
            next(error);
        }
    };

    /**
     * PUT /v1/admin/occasions/:id
     * Update occasion
     */
    updateOccasion = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const validated = updateOccasionSchema.parse(req.body);
            const occasion = await this.service.updateOccasion(id, validated);
            res.json({ message: 'Occasion updated', occasion });
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /v1/admin/occasions/:id
     * Delete occasion
     */
    deleteOccasion = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            await this.service.deleteOccasion(id);
            res.json({ message: 'Occasion deleted' });
        } catch (error) {
            next(error);
        }
    };

    /**
     * PATCH /v1/admin/occasions/:id/toggle
     * Toggle occasion active state
     */
    toggleOccasion = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const occasion = await this.service.toggleOccasion(id);
            const action = occasion.isActive ? 'activated' : 'deactivated';
            res.json({ message: `Occasion ${action}`, occasion });
        } catch (error) {
            next(error);
        }
    };
}

export const occasionController = new OccasionController(occasionService);
