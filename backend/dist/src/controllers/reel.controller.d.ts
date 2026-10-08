import type { Request, Response, NextFunction } from 'express';
import { ReelService } from '../services/reel.service.js';
export declare class ReelController {
    private readonly service;
    constructor(service: ReelService);
    private handleZodError;
    createReel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    listSellerReels: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateSellerReel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteSellerReel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    listAdminReels: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    approveReel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    rejectReel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteReelAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    listPublicReels: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getPublicReel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const reelController: ReelController;
//# sourceMappingURL=reel.controller.d.ts.map