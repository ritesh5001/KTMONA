import type { Request, Response, NextFunction } from 'express';
export declare class ImagekitController {
    /**
     * GET /v1/imagekit/auth
     * Generates ImageKit authentication parameters
     */
    getAuth: (_req: Request, res: Response, next: NextFunction) => void;
}
export declare const imagekitController: ImagekitController;
//# sourceMappingURL=imagekit.controller.d.ts.map