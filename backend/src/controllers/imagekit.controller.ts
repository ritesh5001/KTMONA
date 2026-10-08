import type { Request, Response, NextFunction } from 'express';
import ImageKit from 'imagekit';

export class ImagekitController {
    /**
     * GET /v1/imagekit/auth
     * Generates ImageKit authentication parameters
     */
    getAuth = (_req: Request, res: Response, next: NextFunction): void => {
        try {
            const publicKey = process.env.IMAGEKIT_PUBLIC_KEY?.trim();
            const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
            const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT?.trim();

            if (!publicKey || !privateKey || !urlEndpoint) {
                res.status(500).json({ message: 'ImageKit is not configured' });
                return;
            }

            const imagekit = new ImageKit({
                publicKey,
                privateKey,
                urlEndpoint,
            });

            const authParams = imagekit.getAuthenticationParameters();
            res.set('Cache-Control', 'no-store');
            res.status(200).json(authParams);
        } catch (error) {
            next(error);
        }
    };
}

export const imagekitController = new ImagekitController();
