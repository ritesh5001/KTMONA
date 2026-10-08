import type { Request, Response, NextFunction } from 'express';
import { ReelService, reelService } from '../services/reel.service.js';
import { createReelSchema, reelQuerySchema, updateReelSchema } from '../validators/reel.validation.js';
import { ApiError } from '../errors/ApiError.js';
import { ZodError } from 'zod';

function extractId(req: Request): string {
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) throw ApiError.badRequest('Reel ID is required');
    return id;
}

export class ReelController {
    constructor(private readonly service: ReelService) {}

    private handleZodError(error: ZodError, next: NextFunction): void {
        const details = error.errors.reduce((acc, err) => {
            const key = err.path.join('.');
            acc[key] = err.message;
            return acc;
        }, {} as Record<string, string>);
        next(ApiError.badRequest('Validation failed', details));
    }

    // =========================================================================
    // SELLER ENDPOINTS
    // =========================================================================

    createReel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) throw ApiError.unauthorized('Authentication required');
            const data = createReelSchema.parse(req.body);
            const result = await this.service.createReel(req.user.userId, data);
            res.status(201).json(result);
        } catch (error) {
            if (error instanceof ZodError) { this.handleZodError(error, next); return; }
            next(error);
        }
    };

    listSellerReels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) throw ApiError.unauthorized('Authentication required');
            const filters = reelQuerySchema.parse(req.query);
            const result = await this.service.listSellerReels(req.user.userId, filters);
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) { this.handleZodError(error, next); return; }
            next(error);
        }
    };

    updateSellerReel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) throw ApiError.unauthorized('Authentication required');
            const id = extractId(req);
            const data = updateReelSchema.parse(req.body);
            const result = await this.service.updateSellerReel(id, req.user.userId, data);
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) { this.handleZodError(error, next); return; }
            next(error);
        }
    };

    deleteSellerReel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) throw ApiError.unauthorized('Authentication required');
            const id = extractId(req);
            const result = await this.service.deleteSellerReel(id, req.user.userId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    // =========================================================================
    // ADMIN ENDPOINTS
    // =========================================================================

    listAdminReels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const filters = reelQuerySchema.parse(req.query);
            const result = await this.service.listAdminReels(filters);
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) { this.handleZodError(error, next); return; }
            next(error);
        }
    };

    approveReel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = extractId(req);
            const result = await this.service.approveReel(id);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    rejectReel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = extractId(req);
            const result = await this.service.rejectReel(id);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    deleteReelAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = extractId(req);
            const result = await this.service.deleteReelAdmin(id);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    // =========================================================================
    // PUBLIC ENDPOINTS
    // =========================================================================

    listPublicReels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const filters = reelQuerySchema.parse(req.query);
            const result = await this.service.listPublicReels(filters);
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) { this.handleZodError(error, next); return; }
            next(error);
        }
    };

    getPublicReel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = extractId(req);
            const result = await this.service.getPublicReel(id);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };
}

export const reelController = new ReelController(reelService);
