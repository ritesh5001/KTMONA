import { prisma } from '../config/db.js';
import type { UserEntity, CreateUserData } from '@/types/auth.types.js';

/**
 * Auth Repository
 * Handles all database operations for authentication
 * No business logic - only data access
 */
export class AuthRepository {
    /**
     * Find a user by their email address
     */
    async findUserByEmail(email: string): Promise<UserEntity | null> {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    /**
     * Find a user by their phone number
     */
    async findUserByPhone(phone: string): Promise<UserEntity | null> {
        return prisma.user.findFirst({
            where: { phone },
        });
    }

    /**
     * Find a user by email OR phone (for login)
     */
    async findByIdentifier(identifier: string): Promise<UserEntity | null> {
        const normalized = identifier.trim();

        if (normalized.includes('@')) {
            return prisma.user.findUnique({
                where: { email: normalized.toLowerCase() },
            });
        }

        return prisma.user.findUnique({
            where: { phone: normalized },
        });
    }

    /**
     * Check if email or phone already exists
     */
    async existsByEmailOrPhone(email: string, phone: string): Promise<boolean> {
        const user = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { phone }],
            },
            select: { id: true },
        });
        return user !== null;
    }

    /**
     * Find a user by their ID
     */
    async findUserById(id: string): Promise<UserEntity | null> {
        return prisma.user.findUnique({
            where: { id },
        });
    }

    /**
     * Create a new user (no transaction needed for single create)
     */
    async createUser(data: CreateUserData): Promise<UserEntity> {
        return prisma.user.create({
            data: {
                email: data.email,
                phone: data.phone,
                whatsappNumber: data.whatsappNumber ?? null,
                passwordHash: data.passwordHash,
                role: data.role,
                status: data.status,
                isEmailVerified: data.isEmailVerified,
                isPhoneVerified: data.isPhoneVerified,
            },
        });
    }

    /**
     * Update a user by ID
     */
    async updateUser(
        id: string,
        data: Partial<CreateUserData>
    ): Promise<UserEntity> {
        return prisma.user.update({
            where: { id },
            data: {
                ...(data.email !== undefined && { email: data.email }),
                ...(data.phone !== undefined && { phone: data.phone }),
                ...(data.whatsappNumber !== undefined && { whatsappNumber: data.whatsappNumber }),
                ...(data.passwordHash !== undefined && { passwordHash: data.passwordHash }),
                ...(data.role !== undefined && { role: data.role }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.isEmailVerified !== undefined && { isEmailVerified: data.isEmailVerified }),
                ...(data.isPhoneVerified !== undefined && { isPhoneVerified: data.isPhoneVerified }),
            },
        });
    }

    /**
     * Create a new login session
     */
    /**
     * Persist a login session.
     *
     * Uses createMany rather than create even though it writes a single row.
     * Prisma's `create` has to return the created record, so it wraps the INSERT in
     * BEGIN/COMMIT and follows it with a SELECT to hydrate the result — four
     * round-trips to write one row. On this deployment a round-trip to the database
     * costs roughly 2.3s, so that alone made every login several seconds slower.
     *
     * Nothing needs the row back: the caller generates `sessionId` itself and
     * discards the return value, so `createMany` (a plain INSERT, no transaction,
     * no hydration) is exactly equivalent here at a quarter of the cost.
     */
    async createSession(data: {
        sessionId?: string;
        userId: string;
        refreshToken: string;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        expiresAt: Date;
    }): Promise<void> {
        // Single raw INSERT when we already know the id (the normal login path).
        // Prisma's create() would BEGIN, INSERT, SELECT to hydrate, then COMMIT, and
        // createMany still wraps the INSERT in a transaction — four and two
        // round-trips respectively to write one row nobody reads back.
        if (data.sessionId) {
            await prisma.$executeRaw`
                INSERT INTO "login_sessions"
                    ("id", "user_id", "refresh_token", "user_agent", "ip_address",
                     "expires_at", "created_at", "updated_at")
                VALUES (
                    ${data.sessionId},
                    ${data.userId},
                    ${data.refreshToken},
                    ${data.userAgent ?? null},
                    ${data.ipAddress ?? null},
                    ${data.expiresAt},
                    NOW(),
                    NOW()
                )
            `;
            return;
        }

        // No id supplied — let Prisma generate the cuid.
        await prisma.loginSession.createMany({
            data: [
                {
                    userId: data.userId,
                    refreshToken: data.refreshToken,
                    userAgent: data.userAgent ?? null,
                    ipAddress: data.ipAddress ?? null,
                    expiresAt: data.expiresAt,
                },
            ],
        });
    }

    /**
     * Find a session by refresh token
     */
    async findSessionByRefreshToken(refreshToken: string): Promise<{
        id: string;
        userId: string;
        expiresAt: Date;
    } | null> {
        return prisma.loginSession.findFirst({
            where: { refreshToken },
            select: { id: true, userId: true, expiresAt: true },
        });
    }

    /**
     * Delete a session by ID
     */
    async deleteSession(id: string): Promise<void> {
        await prisma.loginSession.delete({
            where: { id },
        });
    }

    /**
     * Delete all sessions for a user
     */
    async deleteAllUserSessions(userId: string): Promise<void> {
        await prisma.loginSession.deleteMany({
            where: { userId },
        });
    }

    /**
     * Update session with new refresh token (token rotation).
     *
     * Raw UPDATE on purpose. `prisma.loginSession.update()` has to return the updated
     * row, so it runs BEGIN, a SELECT to check the row exists, the UPDATE, a second
     * SELECT to hydrate the result, then COMMIT — five round-trips to change one
     * column, and the caller throws the result away. Token rotation runs on every
     * refresh, so at ~2.3s per round-trip in production that was the single most
     * expensive part of staying signed in.
     */
    async updateSessionRefreshToken(sessionId: string, refreshToken: string): Promise<void> {
        await prisma.$executeRaw`
            UPDATE "login_sessions"
            SET "refresh_token" = ${refreshToken},
                "updated_at" = NOW()
            WHERE "id" = ${sessionId}
        `;
    }

    /**
     * Get all sessions for a user (for token rotation verification)
     */
    async findSessionsByUserId(userId: string): Promise<Array<{
        id: string;
        refreshToken: string;
        expiresAt: Date;
    }>> {
        return prisma.loginSession.findMany({
            where: { userId },
            select: { id: true, refreshToken: true, expiresAt: true },
        });
    }

    /**
     * Get all sessions for a user (for listing - safe fields only)
     */
    async getSessionsForUser(userId: string): Promise<Array<{
        id: string;
        userAgent: string | null;
        ipAddress: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>> {
        return prisma.loginSession.findMany({
            where: { userId },
            select: {
                id: true,
                userAgent: true,
                ipAddress: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Delete a session by ID only if it belongs to the user
     * Returns true if deleted, false if not found
     */
    async deleteUserSession(userId: string, sessionId: string): Promise<boolean> {
        const result = await prisma.loginSession.deleteMany({
            where: {
                id: sessionId,
                userId: userId,
            },
        });
        return result.count > 0;
    }

    /**
     * Check if a session exists for the given user
     */
    async findSessionByIdAndUser(sessionId: string, userId: string): Promise<{
        id: string;
        refreshToken: string;
        expiresAt: Date;
    } | null> {
        return prisma.loginSession.findFirst({
            where: {
                id: sessionId,
                userId: userId,
            },
            select: { id: true, refreshToken: true, expiresAt: true },
        });
    }
}

// Export singleton instance
export const authRepository = new AuthRepository();
