/**
 * Catalog feed for Shiprocket Checkout (Fastrr).
 *
 * Shiprocket does not push to us — it polls three seller-built endpoints and
 * pulls the catalog in. Their contract is Shopify-shaped, so this maps the
 * Tatvivah schema onto that envelope rather than exposing our own product shape.
 *
 * Two of their requirements are not free:
 *
 *   ids     Products, variants and collections must carry unique *long* ids.
 *           Ours are CUID strings, so each table gained a BIGSERIAL
 *           `external_id` surrogate (see the 20260813060000 migration). Rows
 *           created before that migration all have one; the `?? 0` fallbacks
 *           below only guard the type, never a real row.
 *
 *   weight  Shipping is rated on it and nothing here recorded one. Variants now
 *           have `weight_grams`; until a seller fills it in, a garment-category
 *           fallback is sent so Shiprocket rates *something* plausible rather
 *           than treating the parcel as weightless.
 */
import { prisma } from '../config/db.js';
/** Fallback parcel weights, in grams, by category name (lowercased). */
const FALLBACK_WEIGHT_GRAMS = {
    kurta: 500,
    shirts: 300,
    jacket: 700,
    'modi jacket': 600,
    jodhpuri: 1200,
};
const DEFAULT_WEIGHT_GRAMS = 600;
export const SHIPROCKET_MAX_LIMIT = 250;
export const SHIPROCKET_DEFAULT_LIMIT = 100;
function iso(value) {
    return (value ?? new Date()).toISOString();
}
/** BigInt is not JSON-serialisable, and Shiprocket wants a number. */
function toNumericId(value) {
    return value == null ? 0 : Number(value);
}
/** Vendor-entered text is plain; Shiprocket's field is named `body_html`. */
function toBodyHtml(description) {
    const trimmed = description?.trim();
    if (!trimmed)
        return '';
    if (/^\s*</.test(trimmed))
        return trimmed;
    return trimmed
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br />')}</p>`)
        .join('');
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
/**
 * Stable handle for a product. Prefers the persisted slug; the id-suffixed
 * fallback only covers a row created before the slug backfill ran, and stays
 * stable because `external_id` never changes.
 */
function toHandle(slug, title, externalId) {
    if (slug)
        return slug;
    const base = slugify(title);
    const suffix = toNumericId(externalId);
    return base ? `${base}-${suffix}` : `product-${suffix}`;
}
export function slugify(value) {
    return value
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
function resolveWeightGrams(weightGrams, categoryName) {
    if (typeof weightGrams === 'number' && weightGrams > 0)
        return weightGrams;
    return FALLBACK_WEIGHT_GRAMS[categoryName.trim().toLowerCase()] ?? DEFAULT_WEIGHT_GRAMS;
}
/** Only variants a buyer could actually order are worth syncing. */
const SELLABLE_PRODUCT = {
    isPublished: true,
    deletedByAdmin: false,
    status: 'APPROVED',
    adminListingPrice: { not: null },
};
export class ShiprocketCatalogService {
    /**
     * Products with their variants, optionally scoped to one collection.
     *
     * `collectionId` accepts either the numeric `external_id` Shiprocket holds or
     * the internal CUID, so the endpoint keeps working if anyone tests it with a
     * category id copied out of the admin panel.
     */
    async listProducts(query) {
        const where = { ...SELLABLE_PRODUCT };
        if (query.collectionId) {
            const categoryId = await this.resolveCategoryId(query.collectionId);
            // An unknown collection is an empty page, not every product.
            if (!categoryId)
                return { data: { total: 0, products: [] } };
            where.categoryId = categoryId;
        }
        const [total, rows] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { createdAt: 'asc' },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                select: {
                    externalId: true,
                    title: true,
                    slug: true,
                    description: true,
                    images: true,
                    taxRate: true,
                    createdAt: true,
                    updatedAt: true,
                    category: { select: { name: true } },
                    seller: {
                        select: { seller_profiles: { select: { store_name: true } } },
                    },
                    variants: {
                        where: { status: 'APPROVED' },
                        orderBy: { createdAt: 'asc' },
                        select: {
                            externalId: true,
                            size: true,
                            color: true,
                            sku: true,
                            price: true,
                            compareAtPrice: true,
                            images: true,
                            weightGrams: true,
                            createdAt: true,
                            updatedAt: true,
                            inventory: { select: { stock: true } },
                        },
                    },
                },
            }),
        ]);
        return {
            data: {
                total,
                products: rows.map((row) => this.toShiprocketProduct(row)),
            },
        };
    }
    async listCollections(query) {
        const where = { isActive: true };
        const [total, rows] = await Promise.all([
            prisma.category.count({ where }),
            prisma.category.findMany({
                where,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                select: {
                    externalId: true,
                    name: true,
                    slug: true,
                    description: true,
                    image: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
        ]);
        const collections = rows.map((row) => ({
            id: toNumericId(row.externalId),
            title: row.name,
            handle: row.slug,
            body_html: toBodyHtml(row.description),
            image: row.image ? { src: row.image } : null,
            created_at: iso(row.createdAt),
            updated_at: iso(row.updatedAt ?? row.createdAt),
        }));
        return { data: { total, collections } };
    }
    async resolveCategoryId(collectionId) {
        if (/^\d+$/.test(collectionId)) {
            const match = await prisma.category.findUnique({
                where: { externalId: BigInt(collectionId) },
                select: { id: true },
            });
            return match?.id ?? null;
        }
        const match = await prisma.category.findUnique({
            where: { id: collectionId },
            select: { id: true },
        });
        return match?.id ?? null;
    }
    toShiprocketProduct(row) {
        const categoryName = row.category?.name ?? '';
        const productImage = row.images?.[0] ?? null;
        const taxable = Number(row.taxRate ?? 0) > 0;
        const variants = (row.variants ?? []).map((variant) => {
            const color = variant.color?.trim() || null;
            const size = variant.size?.trim() || 'Free Size';
            const grams = resolveWeightGrams(variant.weightGrams ?? null, categoryName);
            const optionValues = { Size: size };
            if (color)
                optionValues.Color = color;
            return {
                id: toNumericId(variant.externalId),
                title: color ? `${color} / ${size}` : size,
                price: Number(variant.price ?? 0).toFixed(2),
                compare_at_price: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice).toFixed(2),
                sku: variant.sku,
                quantity: variant.inventory?.stock ?? 0,
                created_at: iso(variant.createdAt),
                updated_at: iso(variant.updatedAt),
                taxable,
                option_values: optionValues,
                grams,
                weight: Number((grams / 1000).toFixed(3)),
                weight_unit: 'kg',
                image: variant.images?.[0]
                    ? { src: variant.images[0] }
                    : productImage
                        ? { src: productImage }
                        : null,
            };
        });
        // Options are derived from the variants rather than stored, and only
        // appear when the axis actually varies — a single-colour product should
        // not offer the buyer a colour dropdown with one entry.
        const options = [];
        const colors = uniqueOrdered((row.variants ?? []).map((variant) => variant.color?.trim()).filter(Boolean));
        const sizes = uniqueOrdered((row.variants ?? []).map((variant) => variant.size?.trim()).filter(Boolean));
        if (colors.length > 0)
            options.push({ name: 'Color', values: colors });
        if (sizes.length > 0)
            options.push({ name: 'Size', values: sizes });
        return {
            id: toNumericId(row.externalId),
            title: row.title,
            body_html: toBodyHtml(row.description),
            vendor: row.seller?.seller_profiles?.store_name?.trim() || 'Tatvivah Trends',
            product_type: categoryName,
            handle: toHandle(row.slug ?? null, row.title, row.externalId ?? null),
            status: 'active',
            tags: '',
            created_at: iso(row.createdAt),
            updated_at: iso(row.updatedAt),
            image: productImage ? { src: productImage } : null,
            options,
            variants,
        };
    }
}
function uniqueOrdered(values) {
    return Array.from(new Set(values));
}
export const shiprocketCatalogService = new ShiprocketCatalogService();
//# sourceMappingURL=shiprocket-catalog.service.js.map