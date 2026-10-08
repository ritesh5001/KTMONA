import type { Request, Response, NextFunction } from 'express';
export declare class ProfileController {
    /** GET /v1/me */
    getProfile: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /** PATCH /v1/me/avatar */
    updateAvatar: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const profileController: ProfileController;
//# sourceMappingURL=profile.controller.d.ts.map