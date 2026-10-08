import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { profileService } from '../services/profile.service.js';
import { ApiError } from '../errors/ApiError.js';

/**
 * `null` clears the picture; omitting the key is rejected. Making removal
 * explicit means a malformed body can never silently wipe someone's avatar.
 */
const updateAvatarSchema = z.object({
    avatar: z.string().url().nullable(),
});

export class ProfileController {
    /** GET /v1/me */
    getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await profileService.getProfile(req.user!.userId);
            // Personal data: never cacheable by a shared proxy.
            res.set('Cache-Control', 'private, no-store');
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    /** PATCH /v1/me/avatar */
    updateAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { avatar } = updateAvatarSchema.parse(req.body);
            const result = await profileService.updateAvatar(req.user!.userId, avatar);
            res.set('Cache-Control', 'private, no-store');
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) {
                next(ApiError.badRequest('A valid avatar URL, or null to remove it, is required'));
                return;
            }
            next(error);
        }
    };
}

export const profileController = new ProfileController();
