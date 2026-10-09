/**
 * Catalog uploads (Meesho "Upload Catalog"): single-catalog form with up to 9
 * products, drafts, the upload history with QC status, and the image-first
 * prefilled bulk template.
 */

import ExcelJS from 'exceljs';
import { CatalogUploadMode, Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { productService } from '../product.service.js';
import { invalidateProductCaches, invalidateSellerPrivateCaches } from '../../utils/cache.util.js';
import { compact, parseLimit, parsePage } from './common.js';

export const MAX_PRODUCTS_PER_CATALOG = 9;

export const QC_TABS = ['all', 'action_required', 'qc_in_progress', 'qc_error', 'qc_pass', 'draft'] as const;
export type QcTab = (typeof QC_TABS)[number];

export interface CatalogSizeRow {
    size: string;
    sellerPrice: number;
    wdrpPrice?: number | null | undefined;
    prepaidDiscount?: number | null | undefined;
    mrp: number;
    stock: number;
    sku?: string | null | undefined;
}

export interface CatalogProductInput {
    name: string;
    images: string[];
    styleCode?: string | null | undefined;
    netWeightGrams: number;
    description?: string | null | undefined;
    hsnCode?: string | null | undefined;
    gstPercent?: number | null | undefined;
    color?: string | null | undefined;
    attributes: Record<string, string>;
    legal: Record<string, string>;
    sizes: CatalogSizeRow[];
}

type QcStatus = 'DRAFT' | 'QC_IN_PROGRESS' | 'QC_ERROR' | 'QC_PASS' | 'ACTION_REQUIRED';

/** Meesho-style file id: <epoch ms>-<seller code>-<category code>-IN. */
function newFileId(sellerId: string, categoryExternalId: bigint | null): string {
    const seller = parseInt(sellerId.slice(-6), 36) % 10_000_000;
    const cat = categoryExternalId ? String(categoryExternalId) : '0';
    return `${Date.now()}-${seller}-${cat}-IN`;
}

function qcStatusOf(upload: { isDraft: boolean; rowsFailed: number; products: { status: string; deletedByAdmin: boolean }[] }): QcStatus {
    if (upload.isDraft) return 'DRAFT';
    const products = upload.products;
    if (products.length === 0) return upload.rowsFailed > 0 ? 'QC_ERROR' : 'QC_IN_PROGRESS';
    if (products.some((p) => p.status === 'REJECTED' || p.deletedByAdmin)) {
        return products.every((p) => p.status === 'REJECTED' || p.deletedByAdmin) ? 'QC_ERROR' : 'ACTION_REQUIRED';
    }
    if (upload.rowsFailed > 0) return 'ACTION_REQUIRED';
    if (products.some((p) => p.status === 'PENDING')) return 'QC_IN_PROGRESS';
    return 'QC_PASS';
}

function slugSku(name: string, size: string, index: number): string {
    const base = name.replace(/[^a-z0-9]+/gi, '').slice(0, 8).toUpperCase() || 'SKU';
    const sz = size.replace(/[^a-z0-9.]+/gi, '').slice(0, 6).toUpperCase() || 'D';
    return `${base}-${sz}-${Date.now().toString(36).slice(-4).toUpperCase()}${index}`;
}

class SellerCatalogUploadsService {
    async overview(sellerId: string) {
        const grouped = await prisma.catalogUpload.groupBy({
            by: ['mode'],
            where: { sellerId, isDraft: false },
            _count: { _all: true },
        });
        const bulk = grouped.find((g) => g.mode === 'BULK')?._count._all ?? 0;
        const single = grouped.find((g) => g.mode === 'SINGLE')?._count._all ?? 0;
        // Products listed before catalog uploads existed count as single uploads.
        const legacy = await prisma.product.count({ where: { sellerId, catalogUploadId: null } });
        return { total: bulk + single + legacy, bulk, single: single + legacy };
    }

    async list(sellerId: string, query: Record<string, unknown>) {
        const mode: CatalogUploadMode = query.mode === 'bulk' ? 'BULK' : 'SINGLE';
        const tab = (QC_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as QcTab) : 'all';
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 20, 50);
        const search = typeof query.search === 'string' ? query.search.trim() : '';
        const categoryId = typeof query.categoryId === 'string' && query.categoryId ? query.categoryId : undefined;

        const where: Prisma.CatalogUploadWhereInput = compact({
            sellerId,
            mode,
            categoryId,
            fileId: search ? { contains: search } : undefined,
        });
        // QC status is derived, so filter in memory. Sellers have hundreds of
        // uploads at most, which keeps this cheap.
        const uploads = await prisma.catalogUpload.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                products: {
                    select: { id: true, title: true, images: true, status: true, deletedByAdmin: true, rejectionReason: true, deletedByAdminReason: true },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        const categories = await prisma.category.findMany({
            where: { id: { in: [...new Set(uploads.map((u) => u.categoryId))] } },
            select: { id: true, name: true },
        });
        const catMap = new Map(categories.map((c) => [c.id, c.name]));

        const rows = uploads.map((u) => {
            const status = qcStatusOf(u);
            const draftProducts = u.isDraft ? ((u.draft as { products?: CatalogProductInput[] } | null)?.products ?? []) : [];
            const firstImage = u.products.find((p) => p.images.length)?.images[0] ?? draftProducts.find((p) => p.images?.length)?.images[0] ?? null;
            return {
                id: u.id,
                fileId: u.fileId,
                category: { id: u.categoryId, name: catMap.get(u.categoryId) ?? 'Category' },
                createdAt: u.createdAt,
                updatedAt: u.updatedAt,
                fileName: u.fileName,
                image: firstImage,
                imageCount: u.isDraft ? draftProducts.reduce((n, p) => n + (p.images?.length ?? 0), 0) : u.products.reduce((n, p) => n + p.images.length, 0),
                productCount: u.isDraft ? draftProducts.length : u.products.length,
                rowsTotal: u.rowsTotal,
                rowsFailed: u.rowsFailed,
                errors: (u.errors as { row: number; message: string }[] | null) ?? [],
                status,
                products: u.products.map((p) => ({
                    id: p.id,
                    title: p.title,
                    image: p.images[0] ?? null,
                    status: p.deletedByAdmin ? 'REMOVED' : p.status,
                    reason: p.deletedByAdmin ? p.deletedByAdminReason : p.rejectionReason,
                })),
            };
        });

        // Products listed before catalog uploads existed show as single uploads.
        if (mode === 'SINGLE') {
            const legacy = await prisma.product.findMany({
                where: compact({
                    sellerId,
                    catalogUploadId: null,
                    categoryId,
                    id: search ? { contains: search } : undefined,
                }),
                select: { id: true, title: true, images: true, status: true, deletedByAdmin: true, rejectionReason: true, deletedByAdminReason: true, createdAt: true, updatedAt: true, category: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'desc' },
            });
            for (const p of legacy) {
                rows.push({
                    id: p.id,
                    fileId: p.id,
                    category: p.category,
                    createdAt: p.createdAt,
                    updatedAt: p.updatedAt,
                    fileName: null,
                    image: p.images[0] ?? null,
                    imageCount: p.images.length,
                    productCount: 1,
                    rowsTotal: 1,
                    rowsFailed: 0,
                    errors: [],
                    status: qcStatusOf({ isDraft: false, rowsFailed: 0, products: [p] }),
                    products: [{ id: p.id, title: p.title, image: p.images[0] ?? null, status: p.deletedByAdmin ? 'REMOVED' : p.status, reason: p.deletedByAdmin ? p.deletedByAdminReason : p.rejectionReason }],
                });
            }
            rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        const counts: Record<QcTab, number> = { all: rows.length, action_required: 0, qc_in_progress: 0, qc_error: 0, qc_pass: 0, draft: 0 };
        rows.forEach((r) => {
            counts[r.status.toLowerCase() as QcTab] += 1;
        });
        const filtered = tab === 'all' ? rows : rows.filter((r) => r.status.toLowerCase() === tab);
        const total = filtered.length;
        return {
            mode: mode.toLowerCase(),
            tab,
            counts,
            uploads: filtered.slice((page - 1) * limit, page * limit),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getDraft(sellerId: string, id: string) {
        const upload = await prisma.catalogUpload.findFirst({ where: { id, sellerId, isDraft: true } });
        if (!upload) throw ApiError.notFound('Draft not found');
        return { id: upload.id, fileId: upload.fileId, categoryId: upload.categoryId, draft: upload.draft, updatedAt: upload.updatedAt };
    }

    async saveDraft(sellerId: string, input: { id?: string | undefined; categoryId: string; products: unknown[] }) {
        const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true, externalId: true } });
        if (!category) throw ApiError.notFound('Category not found');
        const draft = { products: input.products } as Prisma.InputJsonValue;
        if (input.id) {
            const existing = await prisma.catalogUpload.findFirst({ where: { id: input.id, sellerId, isDraft: true } });
            if (!existing) throw ApiError.notFound('Draft not found');
            const updated = await prisma.catalogUpload.update({ where: { id: existing.id }, data: { draft, categoryId: category.id } });
            return { id: updated.id, fileId: updated.fileId };
        }
        const created = await prisma.catalogUpload.create({
            data: { fileId: newFileId(sellerId, category.externalId), sellerId, categoryId: category.id, mode: 'SINGLE', isDraft: true, draft },
        });
        return { id: created.id, fileId: created.fileId };
    }

    async deleteDraft(sellerId: string, id: string) {
        const res = await prisma.catalogUpload.deleteMany({ where: { id, sellerId, isDraft: true } });
        if (res.count === 0) throw ApiError.notFound('Draft not found');
        return { deleted: true };
    }

    /**
     * Submit a single catalog: each product becomes a KTMONA product with one
     * variant per size, then goes to QC (admin review). All-or-nothing per
     * product: a failing product is reported and the others are kept.
     */
    async submitSingle(sellerId: string, input: { draftId?: string | undefined; categoryId: string; products: CatalogProductInput[] }) {
        if (input.products.length === 0) throw ApiError.badRequest('Add at least one product');
        if (input.products.length > MAX_PRODUCTS_PER_CATALOG) {
            throw ApiError.badRequest(`A catalog can have at most ${MAX_PRODUCTS_PER_CATALOG} products`);
        }
        const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true, externalId: true, isActive: true } });
        if (!category || !category.isActive) throw ApiError.badRequest('Pick an active category');

        let upload = input.draftId
            ? await prisma.catalogUpload.findFirst({ where: { id: input.draftId, sellerId, isDraft: true } })
            : null;
        upload = upload
            ? await prisma.catalogUpload.update({
                  where: { id: upload.id },
                  data: { isDraft: false, draft: Prisma.DbNull, categoryId: category.id, rowsTotal: input.products.length },
              })
            : await prisma.catalogUpload.create({
                  data: { fileId: newFileId(sellerId, category.externalId), sellerId, categoryId: category.id, mode: 'SINGLE', rowsTotal: input.products.length },
              });

        const errors: { row: number; message: string }[] = [];
        const created: { id: string; title: string }[] = [];
        for (const [index, p] of input.products.entries()) {
            try {
                created.push(await this.createOne(sellerId, category.id, upload.id, p));
            } catch (err) {
                errors.push({ row: index + 1, message: err instanceof Error ? err.message : 'Could not create product' });
            }
        }
        if (created.length === 0) {
            // Nothing went through: keep the form as a draft so no work is lost.
            await prisma.catalogUpload.update({
                where: { id: upload.id },
                data: { isDraft: true, draft: { products: input.products } as unknown as Prisma.InputJsonValue, errors: errors as unknown as Prisma.InputJsonValue },
            });
            throw ApiError.badRequest(errors.map((e) => `Product ${e.row}: ${e.message}`).join(' · '));
        }
        await prisma.catalogUpload.update({
            where: { id: upload.id },
            data: { rowsFailed: errors.length, errors: errors as unknown as Prisma.InputJsonValue },
        });
        await invalidateSellerPrivateCaches(sellerId);
        return { id: upload.id, fileId: upload.fileId, productsCreated: created.length, products: created, errors };
    }

    private async createOne(sellerId: string, categoryId: string, uploadId: string, p: CatalogProductInput) {
        const sizes = p.sizes.filter((s) => s.size.trim());
        if (sizes.length === 0) throw ApiError.badRequest('Add at least one size');
        for (const s of sizes) {
            if (s.mrp < s.sellerPrice) throw ApiError.badRequest(`MRP must be at least the price for size ${s.size}`);
            if (s.wdrpPrice != null && s.wdrpPrice > s.sellerPrice) throw ApiError.badRequest(`Wrong/defective returns price must not exceed the price for size ${s.size}`);
            if (s.prepaidDiscount != null && s.prepaidDiscount >= s.sellerPrice) throw ApiError.badRequest(`Prepaid discount is too high for size ${s.size}`);
        }
        const skus = sizes.map((s, i) => s.sku?.trim() || slugSku(p.name, s.size, i));
        const result = await productService.createProduct(sellerId, {
            categoryId,
            title: p.name,
            description: p.description ?? undefined,
            images: p.images,
            isPublished: false,
            variants: sizes.map((s, i) => ({
                size: s.size.trim(),
                color: p.color?.trim() || undefined,
                sku: skus[i]!,
                sellerPrice: s.sellerPrice,
                compareAtPrice: s.mrp,
                initialStock: s.stock,
            })),
        } as never);
        const productId = (result.product as { id: string }).id;

        await prisma.product.update({
            where: { id: productId },
            data: compact({
                catalogUploadId: uploadId,
                styleCode: p.styleCode?.trim() || undefined,
                attributes: p.attributes as Prisma.InputJsonValue,
                legalInfo: p.legal as Prisma.InputJsonValue,
                hsnCode: p.hsnCode?.trim() || undefined,
                taxRate: p.gstPercent ?? undefined,
            }),
        });
        for (const [i, s] of sizes.entries()) {
            await prisma.productVariant.updateMany({
                where: { productId, sku: skus[i]! },
                data: { weightGrams: p.netWeightGrams, wdrpPrice: s.wdrpPrice ?? null, prepaidDiscount: s.prepaidDiscount ?? null },
            });
        }
        await invalidateProductCaches(productId);
        return { id: productId, title: p.name };
    }

    /** Record a bulk template upload so it shows in the Bulk Uploads tab. */
    async recordBulk(
        sellerId: string,
        categoryId: string,
        fileName: string | null,
        result: { products: { id: string }[]; rowsWithErrors: number; errors: { row: number; message: string }[] }
    ) {
        const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { externalId: true } });
        const upload = await prisma.catalogUpload.create({
            data: {
                fileId: newFileId(sellerId, category?.externalId ?? null),
                sellerId,
                categoryId,
                mode: 'BULK',
                fileName,
                rowsTotal: result.products.length + result.rowsWithErrors,
                rowsFailed: result.rowsWithErrors,
                errors: result.errors.slice(0, 500) as unknown as Prisma.InputJsonValue,
            },
        });
        if (result.products.length) {
            await prisma.product.updateMany({
                where: { id: { in: result.products.map((p) => p.id) }, sellerId },
                data: { catalogUploadId: upload.id },
            });
        }
        return { id: upload.id, fileId: upload.fileId };
    }

    /**
     * Image-first bulk upload: one template row per uploaded front image, with
     * the image link already filled, so the seller only adds the details.
     */
    async prefilledTemplate(categoryId: string, imageUrls: string[]): Promise<{ file: Buffer; fileName: string }> {
        if (imageUrls.length === 0) throw ApiError.badRequest('Upload at least one image');
        const { sellerCatalogService } = await import('./catalog.service.js');
        const { file, fileName } = await sellerCatalogService.catalogTemplate(categoryId);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(file as unknown as ArrayBuffer);
        const ws = wb.getWorksheet('Catalog');
        if (!ws) throw ApiError.internal('Template is missing the Catalog sheet');
        // Drop the two sample rows and add one row per image.
        ws.spliceRows(2, 2);
        const headers: string[] = [];
        ws.getRow(1).eachCell((cell, idx) => {
            headers[idx] = String(cell.value ?? '');
        });
        const col = (prefix: string) => headers.findIndex((h) => h?.startsWith(prefix));
        const imageCol = col('Image URLs');
        const groupCol = col('Product Group ID');
        const sizeCol = col('Size');
        imageUrls.forEach((url, i) => {
            const row = ws.getRow(i + 2);
            if (groupCol > 0) row.getCell(groupCol).value = `P${String(i + 1).padStart(3, '0')}`;
            if (imageCol > 0) row.getCell(imageCol).value = url;
            if (sizeCol > 0) row.getCell(sizeCol).value = 'Free Size';
            row.commit();
        });
        return { file: Buffer.from(await wb.xlsx.writeBuffer()), fileName: fileName.replace('.xlsx', '-prefilled.xlsx') };
    }
}

export const sellerCatalogUploadsService = new SellerCatalogUploadsService();
