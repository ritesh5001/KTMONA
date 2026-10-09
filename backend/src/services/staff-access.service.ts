/**
 * Employee access checks for the admin API.
 *
 * Employees are ADMIN-role accounts flagged `isEmployee`; they may only call
 * the API paths of the sections in `staffPermissions`. Their access is read
 * from the database (cached briefly) rather than from the JWT, so a change an
 * admin makes — new sections, or deactivating the employee — applies within
 * seconds instead of when the 15-minute access token expires.
 */

import type { Request } from 'express';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { permissionForPath, type StaffPermission } from '../config/staff-permissions.js';

const CACHE_TTL_MS = 30_000;

export interface StaffAccess {
    isEmployee: boolean;
    permissions: StaffPermission[];
    active: boolean;
}

const cache = new Map<string, { value: StaffAccess; expiresAt: number }>();

export const staffAccessService = {
    async get(userId: string): Promise<StaffAccess> {
        const hit = cache.get(userId);
        if (hit && hit.expiresAt > Date.now()) return hit.value;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isEmployee: true, staffPermissions: true, status: true },
        });
        const value: StaffAccess = {
            isEmployee: user?.isEmployee ?? false,
            permissions: (user?.staffPermissions ?? []) as StaffPermission[],
            active: user?.status === 'ACTIVE',
        };
        cache.set(userId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value;
    },

    /** Drop the cached access so the next request re-reads it. */
    invalidate(userId: string): void {
        cache.delete(userId);
    },

    /** Throws unless the signed-in admin account may call this request's path. */
    async assertAllowed(req: Request): Promise<void> {
        const userId = req.user?.userId;
        if (!userId) throw ApiError.unauthorized('Authentication required');

        const access = await this.get(userId);
        if (!access.isEmployee) return;
        if (!access.active) throw ApiError.unauthorized('This employee account has been deactivated');

        const path = (req.originalUrl || req.url).split('?')[0] ?? '';
        const required = permissionForPath(path);
        if (required === 'always') return;
        if (!required || !access.permissions.includes(required)) {
            throw ApiError.forbidden("Your employee account doesn't have access to this section");
        }
    },
};
