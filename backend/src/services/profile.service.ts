import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { z } from 'zod';

export const updateProfileSchema = z.object({
    fullName: z.string().trim().min(2, 'Enter your name').max(80).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).nullable().optional(),
    /** YYYY-MM-DD */
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').nullable().optional(),
});

/** Where refunds for Cash on Delivery orders are paid. */
export const refundDetailsSchema = z.discriminatedUnion('method', [
    z.object({
        method: z.literal('UPI'),
        upiId: z.string().trim().regex(/^[\w.\-]{2,256}@[a-zA-Z][a-zA-Z0-9.]{1,64}$/, 'Enter a valid UPI ID, e.g. name@okaxis'),
    }),
    z.object({
        method: z.literal('BANK'),
        accountHolder: z.string().trim().min(2, 'Enter the account holder name').max(100),
        accountNumber: z.string().trim().regex(/^\d{9,18}$/, 'Account number must be 9 to 18 digits'),
        ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code, e.g. SBIN0001234'),
        bankName: z.string().trim().max(100).optional(),
    }),
]);

/** Only the last four digits ever leave the server. */
function maskAccount(n: string | null): string | null {
    return n ? `•••• ${n.slice(-4)}` : null;
}

export interface ProfileResponse {
    profile: {
        userId: string;
        fullName: string | null;
        email: string | null;
        phone: string | null;
        avatar: string | null;
        gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null;
        dob: string | null;
    };
}

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
function assertHostedImageUrl(url: string): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw ApiError.badRequest('Avatar must be a valid URL');
    }

    if (parsed.protocol !== 'https:') {
        throw ApiError.badRequest('Avatar URL must use HTTPS');
    }

    if (!ALLOWED_AVATAR_HOSTS.includes(parsed.hostname)) {
        throw ApiError.badRequest('Avatar must be uploaded through KTMONA');
    }
}

export class ProfileService {
    async getProfile(userId: string): Promise<ProfileResponse> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone: true,
                user_profiles: { select: { full_name: true, avatar: true, gender: true, dob: true } },
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
                gender: user.user_profiles?.gender ?? null,
                dob: user.user_profiles?.dob ? user.user_profiles.dob.toISOString().slice(0, 10) : null,
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
    async updateAvatar(userId: string, avatar: string | null): Promise<ProfileResponse> {
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

    /** Edit name, gender and date of birth (Meesho-style "Edit Profile"). */
    async updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>): Promise<ProfileResponse> {
        const data = {
            ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
            ...(input.gender !== undefined ? { gender: input.gender } : {}),
            ...(input.dob !== undefined ? { dob: input.dob ? new Date(`${input.dob}T00:00:00Z`) : null } : {}),
        };
        if (input.dob) {
            const dob = new Date(`${input.dob}T00:00:00Z`);
            if (Number.isNaN(dob.getTime()) || dob > new Date()) throw ApiError.badRequest('Enter a valid date of birth');
        }
        await prisma.user_profiles.upsert({
            where: { user_id: userId },
            create: { user_id: userId, full_name: input.fullName ?? '', updated_at: new Date(), ...data },
            update: { ...data, updated_at: new Date() },
        });
        return this.getProfile(userId);
    }

    async getRefundDetails(userId: string) {
        const row = await prisma.refundPayoutDetail.findUnique({ where: { userId } });
        if (!row) return { refundDetails: null };
        return {
            refundDetails: {
                method: row.method as 'UPI' | 'BANK',
                upiId: row.upiId,
                accountHolder: row.accountHolder,
                accountNumberMasked: maskAccount(row.accountNumber),
                ifsc: row.ifsc,
                bankName: row.bankName,
                updatedAt: row.updatedAt,
            },
        };
    }

    async saveRefundDetails(userId: string, input: z.infer<typeof refundDetailsSchema>) {
        const data =
            input.method === 'UPI'
                ? { method: 'UPI', upiId: input.upiId, accountHolder: null, accountNumber: null, ifsc: null, bankName: null }
                : {
                      method: 'BANK',
                      upiId: null,
                      accountHolder: input.accountHolder,
                      accountNumber: input.accountNumber,
                      ifsc: input.ifsc,
                      bankName: input.bankName ?? null,
                  };
        await prisma.refundPayoutDetail.upsert({ where: { userId }, create: { userId, ...data }, update: data });
        return this.getRefundDetails(userId);
    }

    async deleteRefundDetails(userId: string) {
        await prisma.refundPayoutDetail.deleteMany({ where: { userId } });
        return { refundDetails: null };
    }
}

export const profileService = new ProfileService();
