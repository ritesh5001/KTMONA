import { occasionService } from '../services/occasion.service.js';
import { createOccasionSchema, updateOccasionSchema } from '../validators/occasion.validation.js';
/**
 * Occasion Controller
 * Handles HTTP layer for occasion endpoints
 */
export class OccasionController {
    service;
    constructor(service) {
        this.service = service;
    }
    // =========================================================================
    // PUBLIC
    // =========================================================================
    /**
     * GET /v1/occasions
     * List all active occasions
     */
    listOccasions = async (_req, res, next) => {
        try {
            const result = await this.service.listOccasions();
            res.status(200).json(result);
        }
        catch (error) {
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
    listAllOccasions = async (_req, res, next) => {
        try {
            const result = await this.service.listAllOccasions();
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * POST /v1/admin/occasions
     * Create occasion
     */
    createOccasion = async (req, res, next) => {
        try {
            const validated = createOccasionSchema.parse(req.body);
            const occasion = await this.service.createOccasion(validated);
            res.status(201).json({ message: 'Occasion created', occasion });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * PUT /v1/admin/occasions/:id
     * Update occasion
     */
    updateOccasion = async (req, res, next) => {
        try {
            const id = req.params['id'];
            const validated = updateOccasionSchema.parse(req.body);
            const occasion = await this.service.updateOccasion(id, validated);
            res.json({ message: 'Occasion updated', occasion });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * DELETE /v1/admin/occasions/:id
     * Delete occasion
     */
    deleteOccasion = async (req, res, next) => {
        try {
            const id = req.params['id'];
            await this.service.deleteOccasion(id);
            res.json({ message: 'Occasion deleted' });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * PATCH /v1/admin/occasions/:id/toggle
     * Toggle occasion active state
     */
    toggleOccasion = async (req, res, next) => {
        try {
            const id = req.params['id'];
            const occasion = await this.service.toggleOccasion(id);
            const action = occasion.isActive ? 'activated' : 'deactivated';
            res.json({ message: `Occasion ${action}`, occasion });
        }
        catch (error) {
            next(error);
        }
    };
}
export const occasionController = new OccasionController(occasionService);
//# sourceMappingURL=occasion.controller.js.map