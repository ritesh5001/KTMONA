/**
 * Catalog QC: review queue with automatic checks and bulk approve/reject.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { adminService } from '../admin.service.js';
import { parseLimit, parsePage, round2, sellerCode } from '../seller-center/common.js';
import { storeNames } from './penalties.service.js';

export const QC_REASONS = [
    'Blurry or low-quality images',
    'Image does not match the product',
    'Watermark, logo or text on images',
    'Wrong category',
    'Incomplete or misleading title/description',
    'Size or colour variants are incorrect',
    'Price looks incorrect',
    'MRP is inflated',
    'Duplicate listing',
    'Prohibited or restricted product',
    'Brand / trademark violation',
] as const;

class AdminQcService {
    async queue(query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 20, 50);
        const search = typeof query.search === 'string' ? query.search.trim() : '';
        const categoryId = typeof query.categoryId === 'string' && query.categoryId ? query.categoryId : undefined;
        const where: Prisma.ProductWhereInput = {
            deletedByAdmin: false,
            OR: [{ status: 'PENDING' }, { variants: { some: { status: 'PENDING' } } }],
            ...(categoryId ? { categoryId } : {}),
            ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };
        const [total, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { createdAt: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    category: { select: { id: true, name: true } },
                    variants: { include: { inventory: true }, orderBy: { createdAt: 'asc' } },
                },
            }),
        ]);

        const categoryIds = [...new Set(products.map((p) => p.categoryId))];
        const medians = categoryIds.length
            ? await prisma.$queryRaw<{ category_id: string; median: number | null }[]>`
                SELECT p."category_id", percentile_cont(0.5) WITHIN GROUP (ORDER BY v."price") AS median
                FROM "product_variants" v JOIN "products" p ON p."id" = v."product_id"
                WHERE v."status" = 'APPROVED' AND p."is_published" = true AND p."category_id" IN (${Prisma.join(categoryIds)})
                GROUP BY p."category_id" HAVING COUNT(*) >= 5`
            : [];
        const medianMap = new Map(medians.map((m) => [m.category_id, m.median == null ? null : Number(m.median)]));
        const names = await storeNames(products.map((p) => p.sellerId));
        const dupes = await prisma.product.groupBy({
            by: ['sellerId', 'title'],
            where: { sellerId: { in: [...new Set(products.map((p) => p.sellerId))] }, title: { in: products.map((p) => p.title) }, deletedByAdmin: false },
            _count: { _all: true },
        });

        return {
            reasons: QC_REASONS,
            products: products.map((p) => {
                const images = p.images.length ? p.images : [...new Set(p.variants.flatMap((v) => v.images))];
                const pending = p.variants.filter((v) => v.status === 'PENDING');
                const minPrice = Math.min(...p.variants.map((v) => v.sellerPrice));
                const median = medianMap.get(p.categoryId) ?? null;
                const flags: { level: 'error' | 'warning'; text: string }[] = [];
                if (images.length === 0) flags.push({ level: 'error', text: 'No images' });
                else if (images.length < 3) flags.push({ level: 'warning', text: `Only ${images.length} image(s)` });
                if (!p.description || p.description.trim().length < 30) flags.push({ level: 'warning', text: 'Short or missing description' });
                if (p.variants.some((v) => v.compareAtPrice != null && v.compareAtPrice < v.sellerPrice)) flags.push({ level: 'error', text: 'MRP below price' });
                if (p.variants.some((v) => v.compareAtPrice != null && v.compareAtPrice > v.sellerPrice * 4)) flags.push({ level: 'warning', text: 'MRP more than 4× price' });
                if (median != null && (minPrice > median * 2.5 || minPrice < median * 0.25)) flags.push({ level: 'warning', text: `Price far from category median (~Rs. ${round2(median)})` });
                if ((dupes.find((d) => d.sellerId === p.sellerId && d.title === p.title)?._count._all ?? 0) > 1) flags.push({ level: 'warning', text: 'Seller has another product with the same title' });
                if (p.variants.every((v) => (v.inventory?.stock ?? 0) === 0)) flags.push({ level: 'warning', text: 'No stock' });
                return {
                    id: p.id,
                    title: p.title,
                    description: p.description,
                    images,
                    category: p.category,
                    seller: { id: p.sellerId, code: sellerCode(p.sellerId), storeName: names.get(p.sellerId) ?? null },
                    submittedAt: p.updatedAt,
                    isEdit: p.variants.some((v) => v.status === 'APPROVED'),
                    hsnCode: p.hsnCode,
                    taxRate: p.taxRate,
                    variants: p.variants.map((v) => ({
                        id: v.id,
                        size: v.size,
                        color: v.color,
                        sku: v.sku,
                        sellerPrice: v.sellerPrice,
                        mrp: v.compareAtPrice,
                        stock: v.inventory?.stock ?? 0,
                        status: v.status,
                    })),
                    pendingVariants: pending.length,
                    categoryMedianPrice: median,
                    flags,
                };
            }),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async bulkReview(adminId: string, input: { productIds: string[]; action: 'APPROVE' | 'REJECT'; reason?: string | undefined }) {
        if (input.action === 'REJECT' && !input.reason?.trim()) throw ApiError.badRequest('Pick a rejection reason');
        const results: { productId: string; ok: boolean; error?: string }[] = [];
        for (const id of input.productIds) {
            try {
                if (input.action === 'APPROVE') await adminService.approveProduct(id, adminId);
                else await adminService.rejectProduct(id, input.reason!.trim(), adminId);
                results.push({ productId: id, ok: true });
            } catch (err) {
                results.push({ productId: id, ok: false, error: err instanceof Error ? err.message : 'Failed' });
            }
        }
        return { results, done: results.filter((r) => r.ok).length };
    }
}

export const adminQcService = new AdminQcService();
