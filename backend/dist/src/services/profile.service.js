import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
/** Only images we host. See `assertHostedImageUrl`. */
const ALLOWED_AVATAR_HOSTS = ['ik.imagekit.io'];
/**
 * Avatars are set by URL rather than uploaded through the API — the client puts
 * the file on ImageKit directly using a short-lived signature from
 * /v1/imagekit/auth, then tells us where it landed.
 *
 * That means this value is attacker-controlled, and it gets rendered in every
 * surface that shows the user. Restricting it to our own CDN stops the field
 * being used to point at arbitrary third-party URLs, which would leak the
 * viewer's IP to that host on every render and let someone swap the image after
 * the fact.
 */
function assertHostedImageUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw ApiError.badRequest('Avatar must be a valid URL');
    }
    if (parsed.protocol !== 'https:') {
        throw ApiError.badRequest('Avatar URL must use HTTPS');
    }
    if (!ALLOWED_AVATAR_HOSTS.includes(parsed.hostname)) {
        throw ApiError.badRequest('Avatar must be uploaded through Tatvivah');
    }
}
export class ProfileService {
    async getProfile(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone: true,
                user_profiles: { select: { full_name: true, avatar: true } },
            },
        });
        if (!user) {
            throw ApiError.notFound('User not found');
        }
        return {
            profile: {
                userId: user.id,
                fullName: user.user_profiles?.full_name ?? null,
                email: user.email,
                phone: user.phone,
                avatar: user.user_profiles?.avatar ?? null,
            },
        };
    }
    /**
     * Set or clear the avatar.
     *
     * `null` is a deliberate, distinct outcome from "not provided": it removes
     * the picture and returns the user to their initial, which is the only way
     * to undo an upload they regret.
     */
    async updateAvatar(userId, avatar) {
        if (avatar !== null) {
            assertHostedImageUrl(avatar);
        }
        const existing = await prisma.user_profiles.findUnique({
            where: { user_id: userId },
            select: { user_id: true },
        });
        if (!existing) {
            // Accounts created before profiles existed have no row to update.
            throw ApiError.notFound('Profile not found');
        }
        await prisma.user_profiles.update({
            where: { user_id: userId },
            data: { avatar, updated_at: new Date() },
        });
        return this.getProfile(userId);
    }
}
export const profileService = new ProfileService();
//# sourceMappingURL=profile.service.js.map