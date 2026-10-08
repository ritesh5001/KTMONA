import type { UserEntity, CreateUserData } from '@/types/auth.types.js';
/**
 * Auth Repository
 * Handles all database operations for authentication
 * No business logic - only data access
 */
export declare class AuthRepository {
    /**
     * Find a user by their email address
     */
    findUserByEmail(email: string): Promise<UserEntity | null>;
    /**
     * Find a user by their phone number
     */
    findUserByPhone(phone: string): Promise<UserEntity | null>;
    /**
     * Find a user by email OR phone (for login)
     */
    findByIdentifier(identifier: string): Promise<UserEntity | null>;
    /**
     * Check if email or phone already exists
     */
    existsByEmailOrPhone(email: string, phone: string): Promise<boolean>;
    /**
     * Find a user by their ID
     */
    findUserById(id: string): Promise<UserEntity | null>;
    /**
     * Create a new user (no transaction needed for single create)
     */
    createUser(data: CreateUserData): Promise<UserEntity>;
    /**
     * Update a user by ID
     */
    updateUser(id: string, data: Partial<CreateUserData>): Promise<UserEntity>;
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
    createSession(data: {
        sessionId?: string;
        userId: string;
        refreshToken: string;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        expiresAt: Date;
    }): Promise<void>;
    /**
     * Find a session by refresh token
     */
    findSessionByRefreshToken(refreshToken: string): Promise<{
        id: string;
        userId: string;
        expiresAt: Date;
    } | null>;
    /**
     * Delete a session by ID
     */
    deleteSession(id: string): Promise<void>;
    /**
     * Delete all sessions for a user
     */
    deleteAllUserSessions(userId: string): Promise<void>;
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
    updateSessionRefreshToken(sessionId: string, refreshToken: string): Promise<void>;
    /**
     * Get all sessions for a user (for token rotation verification)
     */
    findSessionsByUserId(userId: string): Promise<Array<{
        id: string;
        refreshToken: string;
        expiresAt: Date;
    }>>;
    /**
     * Get all sessions for a user (for listing - safe fields only)
     */
    getSessionsForUser(userId: string): Promise<Array<{
        id: string;
        userAgent: string | null;
        ipAddress: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>>;
    /**
     * Delete a session by ID only if it belongs to the user
     * Returns true if deleted, false if not found
     */
    deleteUserSession(userId: string, sessionId: string): Promise<boolean>;
    /**
     * Check if a session exists for the given user
     */
    findSessionByIdAndUser(sessionId: string, userId: string): Promise<{
        id: string;
        refreshToken: string;
        expiresAt: Date;
    } | null>;
}
export declare const authRepository: AuthRepository;
//# sourceMappingURL=auth.repository.d.ts.map