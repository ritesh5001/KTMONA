/**
 * Sellers suggest category changes (add / rename / remove); admins approve or
 * reject them. Approval applies the change through the normal category service,
 * so slugs, caches and the "no delete while products exist" rule all hold.
 * Nothing in the shared category tree changes until an admin approves.
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { categoryService } from './category.service.js';
import { notificationService } from '../notifications/notification.service.js';
import { parseLimit, parsePage } from './seller-center/common.js';
import { storeNames } from './admin-center/penalties.service.js';

const reason = z.string().trim().min(5, 'Tell us why (at least a few words)').max(500);
const name = z.string().trim().min(2, 'Category name must be at least 2 characters').max(80);

export const categoryRequestSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('ADD'),
        parentId: z.string().min(1).nullable().optional(),
        name,
        description: z.string().trim().max(500).optional(),
        reason,
    }),
    z.object({
        type: z.literal('EDIT'),
        categoryId: z.string().min(1),
        name,
        description: z.string().trim().max(500).optional(),
        reason,
    }),
    z.object({
        type: z.literal('DELETE'),
        categoryId: z.string().min(1),
        reason,
    }),
]);

export const categoryReviewSchema = z.object({
    action: z.enum(['APPROVE', 'REJECT']),
    note: z.string().trim().max(500).optional(),
    /** Admin may tidy the requested name before approving. */
    name: z.string().trim().min(2).max(80).optional(),
});

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

/** "Women › Ethnic Wear › Sarees" for every category id given. */
async function categoryPaths(ids: string[]): Promise<Map<string, string>> {
    const all = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
    const byId = new Map(all.map((c) => [c.id, c]));
    const out = new Map<string, string>();
    for (const id of new Set(ids)) {
        const parts: string[] = [];
        let cur = byId.get(id);
        let guard = 0;
        while (cur && guard < 10) {
            parts.unshift(cur.name);
            cur = cur.parentId ? byId.get(cur.parentId) : undefined;
            guard += 1;
        }
        if (parts.length) out.set(id, parts.join(' › '));
    }
    return out;
}

type Row = Prisma.CategoryRequestGetPayload<Record<string, never>>;

async function present(rows: Row[]) {
    const ids = rows.flatMap((r) => [r.categoryId, r.parentId, r.resultCategoryId].filter((x): x is string => Boolean(x)));
    const paths = await categoryPaths(ids);
    return rows.map((r) => ({
        id: r.id,
        type: r.type as 'ADD' | 'EDIT' | 'DELETE',
        status: r.status as (typeof STATUSES)[number],
        name: r.name,
        description: r.description,
        reason: r.reason,
        category: r.categoryId ? { id: r.categoryId, path: paths.get(r.categoryId) ?? '(removed)' } : null,
        parent: r.parentId ? { id: r.parentId, path: paths.get(r.parentId) ?? '(removed)' } : null,
        adminNote: r.adminNote,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
        sellerId: r.sellerId,
    }));
}

class CategoryRequestService {
    // ── Seller ───────────────────────────────────────────────────────────
    async create(sellerId: string, input: z.infer<typeof categoryRequestSchema>) {
        if (input.type === 'ADD' && input.parentId) {
            const parent = await prisma.category.findUnique({ where: { id: input.parentId }, select: { id: true } });
            if (!parent) throw ApiError.badRequest('The parent category no longer exists');
        }
        if (input.type !== 'ADD') {
            const cat = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
            if (!cat) throw ApiError.badRequest('That category no longer exists');
        }
        const open = await prisma.categoryRequest.count({ where: { sellerId, status: 'PENDING' } });
        if (open >= 20) throw ApiError.badRequest('You already have 20 requests waiting for review. Please wait for those first.');

        await prisma.categoryRequest.create({
            data: {
                sellerId,
                type: input.type,
                categoryId: input.type === 'ADD' ? null : input.categoryId,
                parentId: input.type === 'ADD' ? input.parentId ?? null : null,
                name: input.type === 'DELETE' ? null : input.name,
                description: input.type === 'DELETE' ? null : input.description ?? null,
                reason: input.reason,
            },
        });
        await notificationService
            .notifyAdmin('Category request', `A seller asked to ${input.type.toLowerCase()} a category. Review it in Admin → Category Requests.`)
            .catch(() => undefined);
        return this.sellerList(sellerId);
    }

    async sellerList(sellerId: string) {
        const rows = await prisma.categoryRequest.findMany({ where: { sellerId }, orderBy: { createdAt: 'desc' }, take: 100 });
        return { requests: await present(rows) };
    }

    async withdraw(sellerId: string, id: string) {
        const { count } = await prisma.categoryRequest.deleteMany({ where: { id, sellerId, status: 'PENDING' } });
        if (!count) throw ApiError.badRequest('Only requests still waiting for review can be withdrawn');
        return this.sellerList(sellerId);
    }

    // ── Admin ────────────────────────────────────────────────────────────
    async adminList(query: Record<string, unknown>) {
        const status = STATUSES.includes(query.status as (typeof STATUSES)[number]) ? (query.status as string) : 'PENDING';
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 25, 100);
        const [total, rows, counts] = await Promise.all([
            prisma.categoryRequest.count({ where: { status } }),
            prisma.categoryRequest.findMany({ where: { status }, orderBy: { createdAt: 'asc' }, skip: (page - 1) * limit, take: limit }),
            Promise.all(STATUSES.map((s) => prisma.categoryRequest.count({ where: { status: s } }))),
        ]);
        const names = await storeNames(rows.map((r) => r.sellerId));
        const requests = (await present(rows)).map((r) => ({ ...r, storeName: names.get(r.sellerId) ?? null }));
        return {
            status,
            counts: Object.fromEntries(STATUSES.map((s, i) => [s, counts[i]])),
            requests,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async review(adminId: string, id: string, input: z.infer<typeof categoryReviewSchema>) {
        const req = await prisma.categoryRequest.findUnique({ where: { id } });
        if (!req) throw ApiError.notFound('Request not found');
        if (req.status !== 'PENDING') throw ApiError.badRequest('This request has already been reviewed');
        if (input.action === 'REJECT' && !input.note) throw ApiError.badRequest('Add a note so the seller knows why');

        let resultCategoryId: string | null = null;
        if (input.action === 'APPROVE') {
            const finalName = input.name ?? req.name ?? undefined;
            if (req.type === 'ADD') {
                const created = await categoryService.createCategory({
                    name: finalName!,
                    ...(req.description ? { description: req.description } : {}),
                    ...(req.parentId ? { parentId: req.parentId } : {}),
                });
                resultCategoryId = created.id;
            } else if (req.type === 'EDIT') {
                await categoryService.updateCategory(req.categoryId!, {
                    ...(finalName ? { name: finalName } : {}),
                    ...(req.description ? { description: req.description } : {}),
                });
                resultCategoryId = req.categoryId;
            } else {
                // Fails with a clear message while products still use it.
                await categoryService.deleteCategory(req.categoryId!);
            }
        }

        await prisma.categoryRequest.update({
            where: { id },
            data: {
                status: input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                adminNote: input.note ?? null,
                reviewedBy: adminId,
                reviewedAt: new Date(),
                resultCategoryId,
                ...(input.name ? { name: input.name } : {}),
            },
        });

        const what = req.type === 'ADD' ? 'new category' : req.type === 'EDIT' ? 'category change' : 'category removal';
        await notificationService
            .create({
                userId: req.sellerId,
                role: 'SELLER',
                type: 'ADMIN_ALERT',
                channel: 'EMAIL',
                content: `Your ${what} request was ${input.action === 'APPROVE' ? 'approved' : 'not approved'}`,
                metadata: {
                    title: input.action === 'APPROVE' ? 'Category request approved' : 'Category request not approved',
                    message: input.note ?? (input.action === 'APPROVE' ? 'The change is now live.' : ''),
                },
                eventKey: `CATEGORY_REQUEST:${id}`,
            })
            .catch(() => undefined);

        return this.adminList({ status: 'PENDING' });
    }
}

export const categoryRequestService = new CategoryRequestService();
