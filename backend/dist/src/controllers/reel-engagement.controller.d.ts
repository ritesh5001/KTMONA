import type { Request, Response, NextFunction } from 'express';
import { ReelEngagementService } from '../services/reel-engagement.service.js';
export declare class ReelEngagementController {
    private readonly service;
    constructor(service: ReelEngagementService);
    likeReel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    unlikeReel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    checkLiked: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    recordView: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    recordProductClick: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getSellerAnalytics: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const reelEngagementController: ReelEngagementController;
//# sourceMappingURL=reel-engagement.controller.d.ts.map