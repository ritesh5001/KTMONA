/**
 * Employees (admin-panel staff with limited sections) and the activity log.
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { hashPassword } from '../../utils/password.util.js';
import { normalizeIndianMobile } from '../../utils/phone.util.js';
import { STAFF_PERMISSIONS, STAFF_PERMISSION_KEYS, type StaffPermission } from '../../config/staff-permissions.js';
import { staffAccessService } from '../staff-access.service.js';
import { parseLimit, parsePage } from '../seller-center/common.js';
import { storeNames } from './penalties.service.js';

const permissionList = z
    .array(z.enum(STAFF_PERMISSION_KEYS as [StaffPermission, ...StaffPermission[]]))
    .max(STAFF_PERMISSION_KEYS.length);

const password = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least 1 number');

export const createEmployeeSchema = z.object({
    firstName: z.string().trim().min(1, 'First name is required').max(60),
    lastName: z.string().trim().max(60).default(''),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    phone: z.string().trim().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits').optional(),
    designation: z.string().trim().max(80).optional(),
    password,
    permissions: permissionList.min(1, 'Give the employee at least one section'),
});

export const updateEmployeeSchema = z.object({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().max(60).optional(),
    designation: z.string().trim().max(80).nullable().optional(),
    permissions: permissionList.optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    password: password.optional(),
});

const employeeSelect = {
    id: true,
    email: true,
    phone: true,
    status: true,
    staffPermissions: true,
    createdAt: true,
    adminProfile: { select: { firstName: true, lastName: true, designation: true } },
    loginSessions: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
} satisfies Prisma.UserSelect;

type EmployeeRow = Prisma.UserGetPayload<{ select: typeof employeeSelect }>;

function present(u: EmployeeRow) {
    return {
        id: u.id,
        name: [u.adminProfile?.firstName, u.adminProfile?.lastName].filter(Boolean).join(' ') || u.email || u.phone || 'Employee',
        firstName: u.adminProfile?.firstName ?? '',
        lastName: u.adminProfile?.lastName ?? '',
        designation: u.adminProfile?.designation ?? null,
        email: u.email,
        phone: u.phone,
        status: u.status,
        permissions: u.staffPermissions,
        createdAt: u.createdAt,
        lastActiveAt: u.loginSessions[0]?.updatedAt ?? null,
    };
}

/** "Name (role)" for every actor id, for the activity log. */
async function actorNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    const out = new Map<string, string>();
    if (unique.length === 0) return out;
    const users = await prisma.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, role: true, email: true, phone: true, isEmployee: true, adminProfile: { select: { firstName: true, lastName: true } } },
    });
    const sellerIds = users.filter((u) => u.role === 'SELLER').map((u) => u.id);
    const stores = await storeNames(sellerIds);
    for (const u of users) {
        const personal = [u.adminProfile?.firstName, u.adminProfile?.lastName].filter(Boolean).join(' ');
        const name = u.role === 'SELLER' ? stores.get(u.id) ?? u.email ?? u.phone : personal || u.email || u.phone;
        out.set(u.id, name ?? u.id);
    }
    return out;
}

function roleLabel(role: string, isEmployee: boolean): string {
    if (isEmployee) return 'Employee';
    if (role === 'SUPER_ADMIN') return 'Super Admin';
    if (role === 'SELLER') return 'Seller';
    return 'Admin';
}

class StaffService {
    permissions() {
        return STAFF_PERMISSIONS;
    }

    /** What the signed-in admin account may use (drives the admin sidebar). */
    async myAccess(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, isEmployee: true, staffPermissions: true, adminProfile: { select: { firstName: true, lastName: true } } },
        });
        if (!user) throw ApiError.notFound('Account not found');
        return {
            role: user.role,
            isEmployee: user.isEmployee,
            roleLabel: roleLabel(user.role, user.isEmployee),
            name: [user.adminProfile?.firstName, user.adminProfile?.lastName].filter(Boolean).join(' ') || null,
            permissions: user.isEmployee ? user.staffPermissions : STAFF_PERMISSION_KEYS,
            canManageEmployees: !user.isEmployee,
        };
    }

    async list() {
        const rows = await prisma.user.findMany({
            where: { isEmployee: true },
            orderBy: { createdAt: 'desc' },
            select: employeeSelect,
        });
        return { employees: rows.map(present) };
    }

    async create(input: z.infer<typeof createEmployeeSchema>) {
        const phone = input.phone ? normalizeIndianMobile(input.phone) : null;
        const clash = await prisma.user.findFirst({
            where: { OR: [{ email: input.email }, ...(phone ? [{ phone }] : [])] },
            select: { id: true },
        });
        if (clash) throw ApiError.conflict('An account with this email or phone already exists');

        const created = await prisma.user.create({
            data: {
                email: input.email,
                phone,
                passwordHash: await hashPassword(input.password),
                role: 'ADMIN',
                status: 'ACTIVE',
                isEmployee: true,
                staffPermissions: [...new Set(input.permissions)],
                isEmailVerified: true,
                adminProfile: {
                    create: {
                        firstName: input.firstName,
                        lastName: input.lastName,
                        designation: input.designation ?? null,
                        phone,
                    },
                },
            },
            select: employeeSelect,
        });
        return present(created);
    }

    async update(employeeId: string, input: z.infer<typeof updateEmployeeSchema>) {
        const existing = await prisma.user.findFirst({ where: { id: employeeId, isEmployee: true }, select: { id: true } });
        if (!existing) throw ApiError.notFound('Employee not found');

        const profile: Prisma.AdminProfileUpdateWithoutUserInput = {
            ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
            ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
            ...(input.designation !== undefined ? { designation: input.designation } : {}),
        };
        await prisma.user.update({
            where: { id: employeeId },
            data: {
                ...(input.permissions ? { staffPermissions: [...new Set(input.permissions)] } : {}),
                ...(input.status ? { status: input.status } : {}),
                ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
                ...(Object.keys(profile).length > 0
                    ? { adminProfile: { upsert: { create: { firstName: input.firstName ?? 'Employee', lastName: input.lastName ?? '' }, update: profile } } }
                    : {}),
            },
        });

        // Deactivating or resetting the password signs the employee out everywhere.
        if (input.status === 'SUSPENDED' || input.password) {
            await prisma.loginSession.deleteMany({ where: { userId: employeeId } });
        }
        staffAccessService.invalidate(employeeId);

        const row = await prisma.user.findUniqueOrThrow({ where: { id: employeeId }, select: employeeSelect });
        return present(row);
    }

    /** The activity log, newest first. */
    async activity(query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 50, 100);
        const str = (key: string) => (typeof query[key] === 'string' && (query[key] as string).trim()) || undefined;
        const panel = str('panel');
        const actorId = str('actorId');
        const search = str('search');
        const from = str('from');
        const to = str('to');

        const where: Prisma.ActivityLogWhereInput = {
            ...(panel ? { panel } : {}),
            ...(actorId ? { actorId } : {}),
            ...(search
                ? {
                      OR: [
                          { action: { contains: search, mode: 'insensitive' } },
                          { path: { contains: search, mode: 'insensitive' } },
                          { actorLabel: { contains: search, mode: 'insensitive' } },
                          { entityId: { contains: search, mode: 'insensitive' } },
                      ],
                  }
                : {}),
            ...(from || to
                ? {
                      createdAt: {
                          ...(from ? { gte: new Date(`${from}T00:00:00+05:30`) } : {}),
                          ...(to ? { lte: new Date(`${to}T23:59:59.999+05:30`) } : {}),
                      },
                  }
                : {}),
        };

        const [total, rows] = await Promise.all([
            prisma.activityLog.count({ where }),
            prisma.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        ]);
        const names = await actorNames(rows.flatMap((r) => (r.actorId ? [r.actorId] : [])));
        const employeeIds = new Set(
            (await prisma.user.findMany({
                where: { id: { in: rows.flatMap((r) => (r.actorId ? [r.actorId] : [])) }, isEmployee: true },
                select: { id: true },
            })).map((u) => u.id),
        );

        return {
            entries: rows.map((r) => ({
                id: r.id,
                at: r.createdAt,
                actorId: r.actorId,
                actorName: (r.actorId && names.get(r.actorId)) || r.actorLabel || 'Unknown',
                actorLabel: r.actorLabel,
                actorRole: roleLabel(r.actorRole, Boolean(r.actorId && employeeIds.has(r.actorId))),
                panel: r.panel,
                action: r.action,
                method: r.method,
                path: r.path,
                entityType: r.entityType,
                entityId: r.entityId,
                details: r.details,
                ip: r.ip,
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    /** People who appear in the log, for the "who" filter. */
    async activityActors() {
        const rows = await prisma.activityLog.groupBy({
            by: ['actorId'],
            where: { actorId: { not: null }, panel: 'admin' },
            _count: { _all: true },
        });
        const ids = rows.flatMap((r) => (r.actorId ? [r.actorId] : []));
        const names = await actorNames(ids);
        return {
            actors: ids
                .map((id) => ({ id, name: names.get(id) ?? id }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        };
    }
}

export const staffService = new StaffService();
