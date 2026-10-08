import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

/**
 * Profile Routes
 * Base path: /v1/me
 *
 * Always scoped to the caller's own token — there is no :userId anywhere here,
 * so one account can never read or modify another's profile.
 */
const profileRouter = Router();

profileRouter.use(authenticate);

/** GET /v1/me — the signed-in user's profile, including their avatar. */
profileRouter.get('/', profileController.getProfile);

/** PATCH /v1/me/avatar — set the avatar URL, or null to remove it. */
profileRouter.patch('/avatar', profileController.updateAvatar);

export { profileRouter };
