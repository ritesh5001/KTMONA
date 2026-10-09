/**
 * Seller catalog: listing tabs, pause/resume, holiday mode, inventory and
 * bulk catalog upload via an Excel template.
 */

import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { productService } from '../product.service.js';
import { createVariantSchema } from '../../validators/variant.validation.js';
import { createProductSchema } from '../../validators/product.validation.js';
import { invalidateProductCaches, invalidateSellerPrivateCaches } from '../../utils/cache.util.js';
import {
    LOW_STOCK_THRESHOLD,
    compact,
    earningsFor,
    getCommissionTerms,
    parseLimit,
    parsePage,
} from './common.js';

export const CATALOG_TABS = ['all', 'live', 'under_review', 'rejected', 'paused', 'out_of_stock'] as const;
export type CatalogTab = (typeof CATALOG_TABS)[number];

const outOfStock: Prisma.ProductWhereInput = {
    variants: { every: { OR: [{ inventory: null }, { inventory: { stock: { lte: 0 } } }] } },
};

function catalogWhere(sellerId: string, tab: CatalogTab): Prisma.ProductWhereInput {
    const base: Prisma.ProductWhereInput = { sellerId };
    switch (tab) {
        case 'live':
            return { ...base, status: 'APPROVED', isPublished: true, deletedByAdmin: false };
        case 'under_review':
            return { ...base, status: 'PENDING', deletedByAdmin: false };
        case 'rejected':
            return { ...base, OR: [{ status: 'REJECTED' }, { deletedByAdmin: true }] };
        case 'paused':
            return { ...base, deletedByAdmin: false, OR: [{ pausedBySeller: true }, { pausedForVacation: true }] };
        case 'out_of_stock':
            return { ...base, status: 'APPROVED', deletedByAdmin: false, ...outOfStock };
        default:
            return base;
    }
}

function listingStatus(p: { status: string; isPublished: boolean; deletedByAdmin: boolean; pausedBySeller: boolean; pausedForVacation: boolean }) {
    if (p.deletedByAdmin) return 'REMOVED';
    if (p.status === 'REJECTED') return 'REJECTED';
    if (p.status === 'PENDING') return 'UNDER_REVIEW';
    if (p.pausedForVacation) return 'PAUSED_HOLIDAY';
    if (p.pausedBySeller) return 'PAUSED';
    return p.isPublished ? 'LIVE' : 'UNDER_REVIEW';
}

// Columns of the bulk upload template, in order.
const TEMPLATE_COLUMNS: { key: string; header: string; width: number; note: string }[] = [
    { key: 'group', header: 'Product Group ID', width: 18, note: 'Rows with the same ID become one product with several variants. Leave blank to group by title.' },
    { key: 'title', header: 'Product Title *', width: 36, note: '3–255 characters.' },
    { key: 'description', header: 'Description', width: 40, note: 'Up to 2000 characters.' },
    { key: 'images', header: 'Image URLs *', width: 40, note: 'Comma-separated https links, first is the main image (1–5).' },
    { key: 'hsn', header: 'HSN Code', width: 12, note: 'Optional.' },
    { key: 'gst', header: 'GST %', width: 8, note: '0, 5, 12, 18 or 28.' },
    { key: 'size', header: 'Size *', width: 10, note: 'e.g. S, M, L, 32, Free Size. Use "Default" if none.' },
    { key: 'color', header: 'Colour', width: 14, note: 'e.g. Navy Blue.' },
    { key: 'sku', header: 'SKU *', width: 18, note: 'Unique per variant.' },
    { key: 'price', header: 'Your Price (₹) *', width: 14, note: 'Price you want to receive before commission.' },
    { key: 'mrp', header: 'MRP (₹)', width: 12, note: 'Shown struck-through. Must be ≥ your price.' },
    { key: 'stock', header: 'Stock *', width: 10, note: 'Units available.' },
];

class SellerCatalogService {
    async list(sellerId: string, query: Record<string, unknown>) {
        const tab = (CATALOG_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as CatalogTab) : 'all';
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 20, 100);
        const search = typeof query.search === 'string' ? query.search.trim() : '';

        const where: Prisma.ProductWhereInput = { AND: [catalogWhere(sellerId, tab)] };
        if (search) {
            (where.AND as Prisma.ProductWhereInput[]).push({
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
                ],
            });
        }

        const [total, products, counts, terms] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    category: { select: { id: true, name: true } },
                    variants: { include: { inventory: true }, orderBy: { createdAt: 'asc' } },
                },
            }),
            this.counts(sellerId),
            getCommissionTerms(sellerId),
        ]);

        return {
            tab,
            counts,
            commission: terms,
            products: products.map((p) => {
                const prices = p.variants.map((v) => v.price).filter((n) => n > 0);
                const sellerPrices = p.variants.map((v) => v.sellerPrice);
                const stock = p.variants.reduce((s, v) => s + (v.inventory?.stock ?? 0), 0);
                const minSeller = sellerPrices.length ? Math.min(...sellerPrices) : 0;
                return {
                    id: p.id,
                    title: p.title,
                    image: p.images[0] ?? p.variants.find((v) => v.images.length)?.images[0] ?? null,
                    category: p.category,
                    status: listingStatus(p),
                    rejectionReason: p.deletedByAdmin ? p.deletedByAdminReason : p.rejectionReason,
                    variantCount: p.variants.length,
                    priceMin: prices.length ? Math.min(...prices) : null,
                    priceMax: prices.length ? Math.max(...prices) : null,
                    sellerPriceMin: minSeller,
                    youEarnMin: earningsFor(minSeller, terms).net,
                    stock,
                    outOfStock: p.variants.length > 0 && p.variants.every((v) => (v.inventory?.stock ?? 0) <= 0),
                    createdAt: p.createdAt,
                };
            }),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async counts(sellerId: string): Promise<Record<CatalogTab, number>> {
        const entries = await Promise.all(
            CATALOG_TABS.map(async (tab) => [tab, await prisma.product.count({ where: catalogWhere(sellerId, tab) })] as const)
        );
        return Object.fromEntries(entries) as Record<CatalogTab, number>;
    }

    async setPaused(sellerId: string, productIds: string[], paused: boolean) {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, sellerId, deletedByAdmin: false },
            select: { id: true, status: true, variants: { select: { status: true } } },
        });
        if (products.length === 0) throw ApiError.notFound('No matching products');

        for (const p of products) {
            const hasApproved = p.variants.some((v) => v.status === 'APPROVED');
            await prisma.product.update({
                where: { id: p.id },
                data: paused
                    ? { pausedBySeller: true, isPublished: false }
                    : { pausedBySeller: false, isPublished: hasApproved },
            });
            await invalidateProductCaches(p.id);
        }
        // Holiday-mode products are resumed by turning holiday mode off.
        await invalidateSellerPrivateCaches(sellerId);
        return { updated: products.length };
    }

    /** Holiday mode pauses every live listing; turning it off resumes those. */
    async setVacation(sellerId: string, on: boolean) {
        await prisma.seller_profiles.update({ where: { user_id: sellerId }, data: { vacation_mode: on, updated_at: new Date() } });
        if (on) {
            await prisma.product.updateMany({
                where: { sellerId, isPublished: true },
                data: { pausedForVacation: true, isPublished: false },
            });
        } else {
            const paused = await prisma.product.findMany({
                where: { sellerId, pausedForVacation: true },
                select: { id: true, pausedBySeller: true, deletedByAdmin: true, variants: { select: { status: true } } },
            });
            for (const p of paused) {
                await prisma.product.update({
                    where: { id: p.id },
                    data: {
                        pausedForVacation: false,
                        isPublished: !p.pausedBySeller && !p.deletedByAdmin && p.variants.some((v) => v.status === 'APPROVED'),
                    },
                });
            }
        }
        await invalidateProductCaches();
        await invalidateSellerPrivateCaches(sellerId);
        return { vacationMode: on };
    }

    // ── Inventory ───────────────────────────────────────────────────────────

    async inventory(sellerId: string, query: Record<string, unknown>) {
        const filter = String(query.filter ?? 'all');
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 50, 200);
        const search = typeof query.search === 'string' ? query.search.trim() : '';

        const where: Prisma.ProductVariantWhereInput = { product: { sellerId, deletedByAdmin: false } };
        const and: Prisma.ProductVariantWhereInput[] = [];
        if (filter === 'out_of_stock') and.push({ OR: [{ inventory: null }, { inventory: { stock: { lte: 0 } } }] });
        if (filter === 'low_stock') and.push({ inventory: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } });
        if (filter === 'in_stock') and.push({ inventory: { stock: { gt: LOW_STOCK_THRESHOLD } } });
        if (search) {
            and.push({
                OR: [
                    { sku: { contains: search, mode: 'insensitive' } },
                    { product: { title: { contains: search, mode: 'insensitive' } } },
                ],
            });
        }
        if (and.length) where.AND = and;

        const since = new Date(Date.now() - 30 * 86_400_000);
        const [total, variants, summary, sold] = await Promise.all([
            prisma.productVariant.count({ where }),
            prisma.productVariant.findMany({
                where,
                include: { inventory: true, product: { select: { id: true, title: true, images: true, status: true, isPublished: true } } },
                orderBy: [{ product: { title: 'asc' } }, { createdAt: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.inventorySummary(sellerId),
            prisma.orderItem.groupBy({
                by: ['variantId'],
                where: { sellerId, order: { createdAt: { gte: since }, status: { notIn: ['CANCELLED', 'PLACED'] } } },
                _sum: { quantity: true },
            }),
        ]);
        const soldMap = new Map(sold.map((s) => [s.variantId, s._sum.quantity ?? 0]));

        return {
            summary,
            lowStockThreshold: LOW_STOCK_THRESHOLD,
            variants: variants.map((v) => {
                const stock = v.inventory?.stock ?? 0;
                const sold30 = soldMap.get(v.id) ?? 0;
                const dailyRate = sold30 / 30;
                return {
                    variantId: v.id,
                    productId: v.product.id,
                    title: v.product.title,
                    image: v.images[0] ?? v.product.images[0] ?? null,
                    size: v.size,
                    color: v.color,
                    sku: v.sku,
                    status: v.status,
                    stock,
                    stockStatus: stock <= 0 ? 'OUT_OF_STOCK' : stock <= LOW_STOCK_THRESHOLD ? 'LOW_STOCK' : 'IN_STOCK',
                    soldLast30Days: sold30,
                    daysOfCover: dailyRate > 0 ? Math.floor(stock / dailyRate) : null,
                    updatedAt: v.inventory?.updatedAt ?? null,
                };
            }),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    /**
     * Meesho inventory screen: products grouped by catalog, filtered by listing
     * status (Active / Activation Pending / Blocked / Paused) and stock level.
     */
    async inventoryCatalogs(sellerId: string, query: Record<string, unknown>) {
        const STATUS = ['active', 'activation_pending', 'blocked', 'paused'] as const;
        const STOCK = ['all', 'out_of_stock', 'low_stock'] as const;
        const status = (STATUS as readonly string[]).includes(String(query.status)) ? String(query.status) : 'active';
        const stock = (STOCK as readonly string[]).includes(String(query.stock)) ? String(query.stock) : 'all';
        const search = typeof query.search === 'string' ? query.search.trim() : '';
        const categoryId = typeof query.categoryId === 'string' && query.categoryId ? query.categoryId : undefined;

        const statusWhere = (key: string): Prisma.ProductWhereInput => {
            switch (key) {
                case 'activation_pending':
                    return { status: 'PENDING', deletedByAdmin: false };
                case 'blocked':
                    return { OR: [{ status: 'REJECTED' }, { deletedByAdmin: true }] };
                case 'paused':
                    return { status: 'APPROVED', deletedByAdmin: false, OR: [{ pausedBySeller: true }, { pausedForVacation: true }] };
                default:
                    return { status: 'APPROVED', deletedByAdmin: false, pausedBySeller: false, pausedForVacation: false };
            }
        };
        const base: Prisma.ProductWhereInput = compact({ sellerId, categoryId });
        const searchWhere: Prisma.ProductWhereInput | null = search
            ? {
                  OR: [
                      { title: { contains: search, mode: 'insensitive' } },
                      { id: search },
                      { styleCode: { contains: search, mode: 'insensitive' } },
                      { catalogUpload: { fileId: { contains: search } } },
                      { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
                  ],
              }
            : null;

        const statusCounts = Object.fromEntries(
            await Promise.all(STATUS.map(async (k) => [k, await prisma.product.count({ where: { AND: [base, statusWhere(k)] } })] as const))
        );
        const products = await prisma.product.findMany({
            where: { AND: [base, statusWhere(status), ...(searchWhere ? [searchWhere] : [])] },
            include: {
                category: { select: { id: true, name: true } },
                catalogUpload: { select: { id: true, fileId: true } },
                variants: { include: { inventory: true }, orderBy: { createdAt: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
            take: 300,
        });

        const since = new Date(Date.now() - 30 * 86_400_000);
        const sold = await prisma.orderItem.groupBy({
            by: ['variantId'],
            where: { sellerId, variantId: { in: products.flatMap((p) => p.variants.map((v) => v.id)) }, order: { createdAt: { gte: since }, status: { notIn: ['CANCELLED', 'PLACED'] } } },
            _sum: { quantity: true },
        });
        const soldMap = new Map(sold.map((s) => [s.variantId, s._sum.quantity ?? 0]));

        const stockOf = (v: { inventory: { stock: number } | null }) => v.inventory?.stock ?? 0;
        const stockMatch = (n: number) => (stock === 'out_of_stock' ? n <= 0 : stock === 'low_stock' ? n > 0 && n <= LOW_STOCK_THRESHOLD : true);
        const allVariants = products.flatMap((p) => p.variants);
        const stockCounts = {
            all: products.length,
            out_of_stock: products.filter((p) => p.variants.some((v) => stockOf(v) <= 0)).length,
            low_stock: products.filter((p) => p.variants.some((v) => stockOf(v) > 0 && stockOf(v) <= LOW_STOCK_THRESHOLD)).length,
        };

        type Catalog = { key: string; catalogId: string; title: string; image: string | null; category: { id: string; name: string }; estimatedOrdersPerDay: number; products: unknown[] };
        const catalogs = new Map<string, Catalog>();
        for (const p of products) {
            const variants = p.variants.filter((v) => stockMatch(stockOf(v)));
            if (variants.length === 0) continue;
            const key = p.catalogUploadId ?? p.id;
            const cat = catalogs.get(key) ?? {
                key,
                catalogId: p.catalogUpload?.fileId ?? p.id,
                title: p.title,
                image: p.images[0] ?? null,
                category: p.category,
                estimatedOrdersPerDay: 0,
                products: [],
            };
            const rows = variants.map((v) => {
                const perDay = (soldMap.get(v.id) ?? 0) / 30;
                cat.estimatedOrdersPerDay += perDay;
                return {
                    variantId: v.id,
                    size: v.size,
                    color: v.color,
                    sku: v.sku,
                    stock: stockOf(v),
                    sellerPrice: v.sellerPrice,
                    customerPrice: v.status === 'APPROVED' ? v.price : null,
                    estimatedOrdersPerDay: Math.round(perDay * 10) / 10,
                    daysToStockout: perDay > 0 ? Math.floor(stockOf(v) / perDay) : null,
                };
            });
            cat.products.push({
                productId: p.id,
                title: p.title,
                image: p.images[0] ?? null,
                styleCode: p.styleCode,
                status: listingStatus(p),
                rejectionReason: p.deletedByAdmin ? p.deletedByAdminReason : p.rejectionReason,
                variants: rows,
            });
            catalogs.set(key, cat);
        }
        const list = [...catalogs.values()];
        if (query.sort === 'stock') {
            const minStock = (c: Catalog) => Math.min(...(c.products as { variants: { stock: number }[] }[]).flatMap((p) => p.variants.map((v) => v.stock)));
            list.sort((a, b) => minStock(a) - minStock(b));
        } else if (query.sort !== 'newest') {
            list.sort((a, b) => b.estimatedOrdersPerDay - a.estimatedOrdersPerDay);
        }
        return {
            status,
            stock,
            statusCounts,
            stockCounts,
            lowStockThreshold: LOW_STOCK_THRESHOLD,
            totalVariants: allVariants.length,
            catalogs: list.map((c) => ({ ...c, estimatedOrdersPerDay: Math.round(c.estimatedOrdersPerDay * 10) / 10 })),
        };
    }

    async inventorySummary(sellerId: string) {
        const scope: Prisma.ProductVariantWhereInput = { product: { sellerId, deletedByAdmin: false } };
        const [total, out, low] = await Promise.all([
            prisma.productVariant.count({ where: scope }),
            prisma.productVariant.count({ where: { ...scope, OR: [{ inventory: null }, { inventory: { stock: { lte: 0 } } }] } }),
            prisma.productVariant.count({ where: { ...scope, inventory: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } } }),
        ]);
        const units = await prisma.inventory.aggregate({ where: { variant: scope }, _sum: { stock: true } });
        return { totalVariants: total, outOfStock: out, lowStock: low, inStock: total - out - low, totalUnits: units._sum.stock ?? 0 };
    }

    async bulkUpdateStock(sellerId: string, updates: { variantId: string; stock: number }[]) {
        const results: { variantId: string; ok: boolean; error?: string }[] = [];
        for (const u of updates) {
            try {
                if (!Number.isInteger(u.stock) || u.stock < 0) throw ApiError.badRequest('Stock must be a whole number ≥ 0');
                await productService.updateStock(u.variantId, sellerId, u.stock);
                results.push({ variantId: u.variantId, ok: true });
            } catch (err) {
                results.push({ variantId: u.variantId, ok: false, error: err instanceof Error ? err.message : 'Failed' });
            }
        }
        await invalidateSellerPrivateCaches(sellerId);
        return { results, updated: results.filter((r) => r.ok).length };
    }

    /** Inventory as an Excel sheet the seller can edit and upload back. */
    async inventoryWorkbook(sellerId: string): Promise<Buffer> {
        const variants = await prisma.productVariant.findMany({
            where: { product: { sellerId, deletedByAdmin: false } },
            include: { inventory: true, product: { select: { title: true } } },
            orderBy: [{ product: { title: 'asc' } }, { createdAt: 'asc' }],
        });
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Inventory');
        ws.columns = [
            { header: 'Variant ID', key: 'id', width: 30 },
            { header: 'Product', key: 'title', width: 40 },
            { header: 'Size', key: 'size', width: 10 },
            { header: 'Colour', key: 'color', width: 14 },
            { header: 'SKU', key: 'sku', width: 20 },
            { header: 'Stock', key: 'stock', width: 10 },
        ];
        variants.forEach((v) => ws.addRow({ id: v.id, title: v.product.title, size: v.size, color: v.color ?? '', sku: v.sku, stock: v.inventory?.stock ?? 0 }));
        styleHeader(ws);
        return Buffer.from(await wb.xlsx.writeBuffer());
    }

    async importInventoryWorkbook(sellerId: string, file: Buffer) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(file as unknown as ArrayBuffer);
        const ws = wb.worksheets[0];
        if (!ws) throw ApiError.badRequest('The file has no sheets');
        const updates: { variantId: string; stock: number }[] = [];
        ws.eachRow((row, n) => {
            if (n === 1) return;
            const id = cellText(row.getCell(1));
            const stock = Number(cellText(row.getCell(6)));
            if (id) updates.push({ variantId: id, stock });
        });
        return this.bulkUpdateStock(sellerId, updates);
    }

    // ── Bulk catalog upload ─────────────────────────────────────────────────

    async catalogTemplate(categoryId: string): Promise<{ file: Buffer; fileName: string }> {
        const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, name: true } });
        if (!category) throw ApiError.notFound('Category not found');

        const wb = new ExcelJS.Workbook();
        wb.creator = 'KTMONA';
        const guide = wb.addWorksheet('Instructions');
        guide.columns = [{ width: 24 }, { width: 90 }];
        guide.addRow(['KTMONA bulk catalog upload']).font = { bold: true, size: 14 };
        guide.addRow(['Category', `${category.name}`]);
        guide.addRow(['Category ID', category.id]);
        guide.addRow([]);
        guide.addRow(['How to fill', 'Fill the "Catalog" sheet from left to right, one row per variant (size/colour). Columns with * are required. Do not rename the headers.']);
        guide.addRow(['Grouping', 'Variants of one product share the same Product Group ID (or the same title when the ID is blank).']);
        guide.addRow(['Review', 'Uploaded products go to the KTMONA team for review and usually go live within 72 hours.']);
        guide.addRow([]);
        TEMPLATE_COLUMNS.forEach((c) => guide.addRow([c.header, c.note]));

        const ws = wb.addWorksheet('Catalog');
        ws.columns = TEMPLATE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
        ws.addRow({
            group: 'TSHIRT-001', title: 'Men Cotton Round Neck T-Shirt', description: 'Soft 180 GSM cotton, regular fit.',
            images: 'https://ik.imagekit.io/your-id/tshirt-front.jpg, https://ik.imagekit.io/your-id/tshirt-back.jpg',
            hsn: '6109', gst: 5, size: 'M', color: 'Navy Blue', sku: 'TS001-NVY-M', price: 299, mrp: 599, stock: 25,
        });
        ws.addRow({ group: 'TSHIRT-001', title: 'Men Cotton Round Neck T-Shirt', size: 'L', color: 'Navy Blue', sku: 'TS001-NVY-L', price: 299, mrp: 599, stock: 20 });
        styleHeader(ws);
        ws.getRow(2).font = { italic: true, color: { argb: 'FF7D88A3' } };
        ws.getRow(3).font = { italic: true, color: { argb: 'FF7D88A3' } };

        const slug = category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return { file: Buffer.from(await wb.xlsx.writeBuffer()), fileName: `ktmona-catalog-${slug}.xlsx` };
    }

    async importCatalog(sellerId: string, categoryId: string, file: Buffer) {
        const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
        if (!category) throw ApiError.notFound('Category not found');

        const wb = new ExcelJS.Workbook();
        try {
            await wb.xlsx.load(file as unknown as ArrayBuffer);
        } catch {
            throw ApiError.badRequest('Could not read the file. Upload the .xlsx template.');
        }
        const ws = wb.getWorksheet('Catalog') ?? wb.worksheets.find((s) => s.name !== 'Instructions');
        if (!ws) throw ApiError.badRequest('The "Catalog" sheet is missing');

        const headerRow = ws.getRow(1);
        const colIndex = new Map<string, number>();
        headerRow.eachCell((cell, idx) => {
            const def = TEMPLATE_COLUMNS.find((c) => c.header.toLowerCase() === cellText(cell).toLowerCase());
            if (def) colIndex.set(def.key, idx);
        });
        for (const required of ['title', 'images', 'size', 'sku', 'price', 'stock']) {
            if (!colIndex.has(required)) throw ApiError.badRequest(`Column "${TEMPLATE_COLUMNS.find((c) => c.key === required)!.header}" is missing`);
        }
        const get = (row: ExcelJS.Row, key: string) => (colIndex.has(key) ? cellText(row.getCell(colIndex.get(key)!)) : '');

        type Group = { rows: number[]; title: string; description: string; images: string[]; hsn: string; gst: number; variants: unknown[] };
        const groups = new Map<string, Group>();
        const errors: { row: number; message: string }[] = [];

        ws.eachRow((row, n) => {
            if (n === 1) return;
            const title = get(row, 'title');
            const sku = get(row, 'sku');
            if (!title && !sku) return; // blank row
            if (/^TS001-NVY-[ML]$/.test(sku)) return; // sample rows

            const variant = createVariantSchema.safeParse({
                size: get(row, 'size') || 'Default',
                color: get(row, 'color') || undefined,
                sku,
                sellerPrice: Number(get(row, 'price')),
                compareAtPrice: get(row, 'mrp') ? Number(get(row, 'mrp')) : undefined,
                initialStock: Number(get(row, 'stock') || 0),
            });
            if (!variant.success) {
                errors.push({ row: n, message: variant.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
                return;
            }
            const key = (get(row, 'group') || title).toLowerCase();
            const group = groups.get(key) ?? {
                rows: [], title, description: get(row, 'description'),
                images: get(row, 'images').split(',').map((s) => s.trim()).filter(Boolean),
                hsn: get(row, 'hsn'), gst: Number(get(row, 'gst') || 0), variants: [],
            };
            group.rows.push(n);
            group.variants.push(variant.data);
            if (!group.images.length) group.images = get(row, 'images').split(',').map((s) => s.trim()).filter(Boolean);
            groups.set(key, group);
        });

        let created = 0;
        const createdProducts: { id: string; title: string }[] = [];
        for (const group of groups.values()) {
            const parsed = createProductSchema.safeParse({
                categoryId,
                title: group.title,
                description: group.description || undefined,
                images: group.images,
                variants: group.variants,
            });
            if (!parsed.success) {
                const message = parsed.error.issues.map((i) => `${i.path.join('.') || 'product'}: ${i.message}`).join('; ');
                group.rows.forEach((row) => errors.push({ row, message }));
                continue;
            }
            try {
                const result = await productService.createProduct(sellerId, parsed.data as never);
                const productId = (result.product as { id: string }).id;
                if (group.hsn || group.gst) {
                    await prisma.product.update({
                        where: { id: productId },
                        data: compact({ hsnCode: group.hsn || undefined, taxRate: Number.isFinite(group.gst) ? group.gst : undefined }),
                    });
                }
                created += 1;
                createdProducts.push({ id: productId, title: group.title });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Could not create product';
                group.rows.forEach((row) => errors.push({ row, message }));
            }
        }

        await invalidateSellerPrivateCaches(sellerId);
        errors.sort((a, b) => a.row - b.row);
        return { productsCreated: created, products: createdProducts, rowsWithErrors: errors.length, errors };
    }
}

function cellText(cell: ExcelJS.Cell): string {
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
        if ('text' in v && typeof v.text === 'string') return v.text.trim();
        if ('result' in v) return String(v.result ?? '').trim();
        if ('richText' in v) return v.richText.map((r) => r.text).join('').trim();
        if ('hyperlink' in v) return String((v as { hyperlink: string }).hyperlink).trim();
    }
    return String(v).trim();
}

function styleHeader(ws: ExcelJS.Worksheet) {
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C1B42' } };
    header.alignment = { vertical: 'middle' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
}

export const sellerCatalogService = new SellerCatalogService();

