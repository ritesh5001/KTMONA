/**
 * Admin Repository
 * Database operations for admin panel
 */
import { prisma } from '../config/db.js';
const memCache = new Map();
const PROFIT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
function getMemCache(key) {
    const entry = memCache.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        memCache.delete(key);
        return null;
    }
    return entry.data;
}
function setMemCache(key, data, ttlMs) {
    memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
function resolvePagination(params) {
    const pageRaw = Number(params?.page ?? 1);
    const limitRaw = Number(params?.limit ?? DEFAULT_LIMIT);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.trunc(pageRaw) : 1;
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : DEFAULT_LIMIT));
    return {
        page,
        limit,
        skip: (page - 1) * limit,
        take: limit,
    };
}
/**
 * Admin Repository Class
 * Handles all admin-related database queries
 */
export class AdminRepository {
    // =========================================================================
    // DASHBOARD STATS (lightweight counts)
    // =========================================================================
    /**
     * Get aggregate counts for admin dashboard — uses COUNT instead of fetching all rows.
     */
    async getStats() {
        const [sellers, products, orders, payments] = await Promise.all([
            prisma.user.count({ where: { role: 'SELLER' } }),
            prisma.product.count(),
            prisma.order.count(),
            prisma.payment.count(),
        ]);
        return { sellers, products, orders, payments };
    }
    /**
     * Get recent sellers (last 5)
     */
    async findRecentSellers(limit = 5) {
        return prisma.user.findMany({
            where: { role: 'SELLER' },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    /**
     * Get recent products (last 5)
     */
    async findRecentProducts(limit = 5) {
        const products = await prisma.product.findMany({
            include: {
                seller: {
                    select: {
                        email: true,
                        phone: true,
                        seller_profiles: { select: { store_name: true } },
                    },
                },
                category: { select: { name: true } },
                occasions: {
                    select: {
                        occasionId: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return products.map((product) => ({
            id: product.id,
            title: product.title,
            description: product.description,
            images: product.images,
            sellerId: product.sellerId,
            sellerName: product.seller?.seller_profiles?.store_name ?? null,
            sellerPhone: product.seller?.phone ?? null,
            sellerEmail: product.seller?.email ?? null,
            categoryId: product.categoryId,
            categoryName: product.category?.name ?? null,
            audience: product.audience,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
            priceApprovedAt: product.priceApprovedAt,
            priceApprovedById: product.priceApprovedById,
            status: product.status,
            rejectionReason: product.rejectionReason,
            approvedAt: product.approvedAt,
            approvedById: product.approvedById,
            isPublished: product.isPublished,
            deletedByAdmin: product.deletedByAdmin,
            deletedByAdminAt: product.deletedByAdminAt,
            deletedByAdminReason: product.deletedByAdminReason,
            createdAt: product.createdAt,
            moderation: {
                status: product.status,
                reason: product.rejectionReason,
                reviewedBy: product.approvedById,
                reviewedAt: product.approvedAt,
            },
            occasionIds: (product.occasions ?? []).map((item) => item.occasionId),
        }));
    }
    // =========================================================================
    // SELLER MANAGEMENT
    // =========================================================================
    /**
     * Find all sellers
     */
    async findAllSellers(params) {
        const { skip, take } = resolvePagination(params);
        const sellers = await prisma.user.findMany({
            where: { role: 'SELLER' },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        });
        return sellers;
    }
    /**
     * Find seller by ID
     */
    async findSellerById(id) {
        return prisma.user.findFirst({
            where: { id, role: 'SELLER' },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
            },
        });
    }
    /**
     * Update seller status
     */
    async updateSellerStatus(id, status) {
        return prisma.user.update({
            where: { id },
            data: { status },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
            },
        });
    }
    // =========================================================================
    // PRODUCT MODERATION
    // =========================================================================
    /**
     * Find all products pending moderation
     */
    async findPendingProducts(params) {
        const { skip, take } = resolvePagination(params);
        const products = await prisma.product.findMany({
            where: {
                deletedByAdmin: false,
                ...(params?.audience ? { audience: params.audience } : {}),
                OR: [
                    { status: 'PENDING' },
                    {
                        variants: {
                            some: { status: 'PENDING' },
                        },
                    },
                ],
            },
            include: {
                seller: {
                    select: {
                        email: true,
                        phone: true,
                        seller_profiles: {
                            select: {
                                store_name: true,
                            },
                        },
                    },
                },
                category: { select: { name: true } },
                occasions: {
                    select: {
                        occasionId: true,
                    },
                },
                variants: {
                    include: { inventory: true },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        });
        return products.map((product) => ({
            id: product.id,
            title: product.title,
            description: product.description,
            images: product.images,
            sellerId: product.sellerId,
            sellerName: product.seller?.seller_profiles?.store_name ?? null,
            sellerPhone: product.seller?.phone ?? null,
            sellerEmail: product.seller?.email ?? null,
            categoryId: product.categoryId,
            categoryName: product.category?.name ?? null,
            audience: product.audience,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
            priceApprovedAt: product.priceApprovedAt,
            priceApprovedById: product.priceApprovedById,
            status: product.status,
            rejectionReason: product.rejectionReason,
            approvedAt: product.approvedAt,
            approvedById: product.approvedById,
            variants: product.variants.map((variant) => ({
                id: variant.id,
                size: variant.size,
                color: variant.color,
                colorHex: variant.colorHex ?? null,
                images: variant.images,
                sku: variant.sku,
                sellerPrice: Number(variant.sellerPrice),
                adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
                price: Number(variant.price),
                compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
                status: variant.status,
                rejectionReason: variant.rejectionReason,
                approvedAt: variant.approvedAt,
                stock: variant.inventory?.stock ?? 0,
            })),
            isPublished: product.isPublished,
            deletedByAdmin: product.deletedByAdmin,
            deletedByAdminAt: product.deletedByAdminAt,
            deletedByAdminReason: product.deletedByAdminReason,
            createdAt: product.createdAt,
            moderation: {
                status: product.status,
                reason: product.rejectionReason,
                reviewedBy: product.approvedById,
                reviewedAt: product.approvedAt,
            },
        }));
    }
    /**
     * Find product by ID with moderation info
     */
    async findProductById(id) {
        // Same 3-statement path as findAllProducts (see hydrateAdminProductRows).
        // The nested-include version cost seven round-trips, and this method runs
        // twice on every admin product save.
        const productRows = await prisma.$queryRaw `
            SELECT
                p."id", p."title", p."description", p."images",
                p."seller_id"                AS "sellerId",
                p."category_id"              AS "categoryId",
                p."audience"::text           AS "audience",
                p."seller_price"             AS "sellerPrice",
                p."admin_listing_price"      AS "adminListingPrice",
                p."price_approved_at"        AS "priceApprovedAt",
                p."price_approved_by_id"     AS "priceApprovedById",
                p."status"::text             AS "status",
                p."rejection_reason"         AS "rejectionReason",
                p."approved_at"              AS "approvedAt",
                p."approved_by_id"           AS "approvedById",
                p."is_published"             AS "isPublished",
                p."deleted_by_admin"         AS "deletedByAdmin",
                p."deleted_by_admin_at"      AS "deletedByAdminAt",
                p."deleted_by_admin_reason"  AS "deletedByAdminReason",
                p."created_at"               AS "createdAt",
                u."email"                    AS "sellerEmail",
                u."phone"                    AS "sellerPhone",
                sp."store_name"              AS "sellerName",
                c."name"                     AS "categoryName"
            FROM "products" p
            LEFT JOIN "users" u            ON u."id"       = p."seller_id"
            LEFT JOIN "seller_profiles" sp ON sp."user_id" = p."seller_id"
            LEFT JOIN "categories" c       ON c."id"       = p."category_id"
            WHERE p."id" = ${id}
        `;
        if (productRows.length === 0)
            return null;
        const hydrated = await this.hydrateAdminProductRows(productRows);
        const product = hydrated[0];
        if (!product)
            return null;
        return {
            id: product.id,
            title: product.title,
            description: product.description,
            images: product.images,
            sellerId: product.sellerId,
            sellerName: product.seller?.seller_profiles?.store_name ?? null,
            sellerPhone: product.seller?.phone ?? null,
            sellerEmail: product.seller?.email ?? null,
            categoryId: product.categoryId,
            categoryName: product.category?.name ?? null,
            audience: product.audience,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
            priceApprovedAt: product.priceApprovedAt,
            priceApprovedById: product.priceApprovedById,
            status: product.status,
            rejectionReason: product.rejectionReason,
            approvedAt: product.approvedAt,
            approvedById: product.approvedById,
            variants: product.variants.map((variant) => ({
                id: variant.id,
                size: variant.size,
                color: variant.color,
                colorHex: variant.colorHex ?? null,
                images: variant.images,
                sku: variant.sku,
                sellerPrice: Number(variant.sellerPrice),
                adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
                price: Number(variant.price),
                compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
                status: variant.status,
                rejectionReason: variant.rejectionReason,
                approvedAt: variant.approvedAt,
                stock: variant.inventory?.stock ?? 0,
            })),
            isPublished: product.isPublished,
            deletedByAdmin: product.deletedByAdmin,
            deletedByAdminAt: product.deletedByAdminAt,
            deletedByAdminReason: product.deletedByAdminReason,
            createdAt: product.createdAt,
            moderation: {
                status: product.status,
                reason: product.rejectionReason,
                reviewedBy: product.approvedById,
                reviewedAt: product.approvedAt,
            },
            occasionIds: (product.occasions ?? []).map((item) => item.occasionId),
        };
    }
    /**
     * List all products for admin view
     */
    /**
     * Given raw product rows (already joined with seller + category), attach their
     * variants/inventory and occasions with two further statements and reshape into
     * the structure the old nested-include query produced.
     *
     * Shared by findAllProducts and findProductById so a single-product read costs
     * three round-trips instead of seven. findProductById runs twice on every admin
     * product save, so on its own it accounted for fourteen statements.
     */
    async hydrateAdminProductRows(productRows) {
        const productIds = productRows.map((row) => row['id']);
        // Nothing on this page — skip the follow-up queries entirely.
        if (productIds.length === 0) {
            return [];
        }
        const [variantRows, occasionRows] = await Promise.all([
            prisma.$queryRawUnsafe(`
                SELECT
                    v."id", v."product_id" AS "productId", v."size", v."color",
                    v."color_hex" AS "colorHex", v."images", v."sku",
                    v."seller_price"        AS "sellerPrice",
                    v."admin_listing_price" AS "adminListingPrice",
                    v."price",
                    v."compare_at_price"    AS "compareAtPrice",
                    v."status"::text        AS "status",
                    v."rejection_reason"    AS "rejectionReason",
                    v."approved_at"         AS "approvedAt",
                    COALESCE(i."stock", 0)  AS "stock"
                FROM "product_variants" v
                LEFT JOIN "inventory" i ON i."variant_id" = v."id"
                WHERE v."product_id" = ANY($1::text[])
                ORDER BY v."created_at" ASC
                `, productIds),
            prisma.productOccasion.findMany({
                where: { productId: { in: productIds } },
                select: { productId: true, occasionId: true },
            }),
        ]);
        const variantsByProduct = new Map();
        for (const variant of variantRows) {
            const key = variant['productId'];
            const list = variantsByProduct.get(key);
            if (list)
                list.push(variant);
            else
                variantsByProduct.set(key, [variant]);
        }
        const occasionsByProduct = new Map();
        for (const row of occasionRows) {
            const list = occasionsByProduct.get(row.productId);
            if (list)
                list.push(row.occasionId);
            else
                occasionsByProduct.set(row.productId, [row.occasionId]);
        }
        // Re-shape into the structure the typed query used to produce, so every
        // caller and the API response stay byte-for-byte identical.
        const products = productRows.map((row) => ({
            ...row,
            seller: {
                email: row['sellerEmail'],
                phone: row['sellerPhone'],
                seller_profiles: row['sellerName'] == null ? null : { store_name: row['sellerName'] },
            },
            category: row['categoryName'] == null ? null : { name: row['categoryName'] },
            occasions: (occasionsByProduct.get(row['id']) ?? []).map((occasionId) => ({ occasionId })),
            variants: (variantsByProduct.get(row['id']) ?? []).map((variant) => ({
                ...variant,
                inventory: { stock: Number(variant['stock'] ?? 0) },
            })),
        }));
        return products;
    }
    async findAllProducts(params) {
        const { skip, take } = resolvePagination(params);
        // Written as explicit JOINs rather than nested `include`s. Prisma 4 resolves
        // every relation with its own statement, so the equivalent typed query cost
        // seven sequential round-trips (products, users, seller_profiles, categories,
        // product_occasions, product_variants, inventory). Against a cross-region
        // database that is seconds of pure waiting on the admin's slowest screen.
        // This is three statements, two of which run concurrently.
        const audience = params?.audience;
        const productRows = await prisma.$queryRawUnsafe(`
            SELECT
                p."id", p."title", p."description", p."images",
                p."seller_id"                AS "sellerId",
                p."category_id"              AS "categoryId",
                p."audience"::text           AS "audience",
                p."seller_price"             AS "sellerPrice",
                p."admin_listing_price"      AS "adminListingPrice",
                p."price_approved_at"        AS "priceApprovedAt",
                p."price_approved_by_id"     AS "priceApprovedById",
                p."status"::text             AS "status",
                p."rejection_reason"         AS "rejectionReason",
                p."approved_at"              AS "approvedAt",
                p."approved_by_id"           AS "approvedById",
                p."is_published"             AS "isPublished",
                p."deleted_by_admin"         AS "deletedByAdmin",
                p."deleted_by_admin_at"      AS "deletedByAdminAt",
                p."deleted_by_admin_reason"  AS "deletedByAdminReason",
                p."created_at"               AS "createdAt",
                u."email"                    AS "sellerEmail",
                u."phone"                    AS "sellerPhone",
                sp."store_name"              AS "sellerName",
                c."name"                     AS "categoryName"
            FROM "products" p
            LEFT JOIN "users" u            ON u."id"       = p."seller_id"
            LEFT JOIN "seller_profiles" sp ON sp."user_id" = p."seller_id"
            LEFT JOIN "categories" c       ON c."id"       = p."category_id"
            ${audience ? `WHERE p."audience" = $3::"ProductAudience"` : ''}
            ORDER BY p."created_at" DESC
            LIMIT $1 OFFSET $2
            `, ...(audience ? [take, skip, audience] : [take, skip]));
        const products = await this.hydrateAdminProductRows(productRows);
        return products.map((product) => ({
            id: product.id,
            title: product.title,
            description: product.description,
            images: product.images,
            sellerId: product.sellerId,
            sellerName: product.seller?.seller_profiles?.store_name ?? null,
            sellerPhone: product.seller?.phone ?? null,
            sellerEmail: product.seller?.email ?? null,
            categoryId: product.categoryId,
            categoryName: product.category?.name ?? null,
            audience: product.audience,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
            priceApprovedAt: product.priceApprovedAt,
            priceApprovedById: product.priceApprovedById,
            status: product.status,
            rejectionReason: product.rejectionReason,
            approvedAt: product.approvedAt,
            approvedById: product.approvedById,
            variants: product.variants.map((variant) => ({
                id: variant.id,
                size: variant.size,
                color: variant.color,
                colorHex: variant.colorHex ?? null,
                images: variant.images,
                sku: variant.sku,
                sellerPrice: Number(variant.sellerPrice),
                adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
                price: Number(variant.price),
                compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
                status: variant.status,
                rejectionReason: variant.rejectionReason,
                approvedAt: variant.approvedAt,
                stock: variant.inventory?.stock ?? 0,
            })),
            isPublished: product.isPublished,
            deletedByAdmin: product.deletedByAdmin,
            deletedByAdminAt: product.deletedByAdminAt,
            deletedByAdminReason: product.deletedByAdminReason,
            createdAt: product.createdAt,
            moderation: {
                status: product.status,
                reason: product.rejectionReason,
                reviewedBy: product.approvedById,
                reviewedAt: product.approvedAt,
            },
            occasionIds: (product.occasions ?? []).map((item) => item.occasionId),
        }));
    }
    /**
     * Soft-delete a product by admin
     */
    async markProductDeletedByAdmin(id, reason) {
        const product = await prisma.product.update({
            where: { id },
            data: {
                isPublished: false,
                status: 'REJECTED',
                rejectionReason: reason ?? 'Deleted by admin',
                deletedByAdmin: true,
                deletedByAdminAt: new Date(),
                deletedByAdminReason: reason ?? 'Deleted by admin',
            },
        });
        return {
            id: product.id,
            title: product.title,
            sellerId: product.sellerId,
            sellerEmail: null,
            categoryId: product.categoryId,
            categoryName: null,
            audience: product.audience,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
            priceApprovedAt: product.priceApprovedAt,
            priceApprovedById: product.priceApprovedById,
            status: product.status,
            rejectionReason: product.rejectionReason,
            approvedAt: product.approvedAt,
            approvedById: product.approvedById,
            isPublished: product.isPublished,
            deletedByAdmin: product.deletedByAdmin,
            deletedByAdminAt: product.deletedByAdminAt,
            deletedByAdminReason: product.deletedByAdminReason,
            createdAt: product.createdAt,
            moderation: {
                status: product.status,
                reason: product.rejectionReason,
                reviewedBy: product.approvedById,
                reviewedAt: product.approvedAt,
            },
        };
    }
    /**
     * Update product moderation status
     */
    async updateProductModeration(productId, status, reviewedBy, reason) {
        await prisma.productModeration.upsert({
            where: { productId },
            update: {
                status,
                reason: reason ?? null,
                reviewedBy,
                reviewedAt: new Date(),
                updated_at: new Date(),
            },
            create: {
                productId,
                status,
                reason: reason ?? null,
                reviewedBy,
                reviewedAt: new Date(),
                updated_at: new Date(),
            },
        });
    }
    /**
     * Update product publish status
     */
    async updateProductPublishStatus(id, isPublished) {
        const product = await prisma.product.update({
            where: { id },
            data: {
                isPublished,
                status: isPublished ? 'APPROVED' : 'REJECTED',
                ...(isPublished
                    ? { rejectionReason: null }
                    : {}),
            },
        });
        return {
            id: product.id,
            title: product.title,
            sellerId: product.sellerId,
            sellerEmail: null,
            categoryId: product.categoryId,
            categoryName: null,
            audience: product.audience,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
            priceApprovedAt: product.priceApprovedAt,
            priceApprovedById: product.priceApprovedById,
            status: product.status,
            rejectionReason: product.rejectionReason,
            approvedAt: product.approvedAt,
            approvedById: product.approvedById,
            isPublished: product.isPublished,
            deletedByAdmin: product.deletedByAdmin,
            deletedByAdminAt: product.deletedByAdminAt,
            deletedByAdminReason: product.deletedByAdminReason,
            createdAt: product.createdAt,
            moderation: {
                status: product.status,
                reason: product.rejectionReason,
                reviewedBy: product.approvedById,
                reviewedAt: product.approvedAt,
            },
        };
    }
    async applyProductApprovalDecision(productId, actorId, decision, reason) {
        const approved = decision === 'APPROVED';
        const product = await prisma.product.update({
            where: { id: productId },
            data: {
                status: decision,
                isPublished: approved,
                rejectionReason: approved ? null : reason ?? null,
                approvedAt: approved ? new Date() : null,
                approvedById: actorId,
            },
        });
        return {
            id: product.id,
            title: product.title,
            sellerId: product.sellerId,
            sellerEmail: null,
            categoryId: product.categoryId,
            categoryName: null,
            audience: product.audience,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
            priceApprovedAt: product.priceApprovedAt,
            priceApprovedById: product.priceApprovedById,
            status: product.status,
            rejectionReason: product.rejectionReason,
            approvedAt: product.approvedAt,
            approvedById: product.approvedById,
            isPublished: product.isPublished,
            deletedByAdmin: product.deletedByAdmin,
            deletedByAdminAt: product.deletedByAdminAt,
            deletedByAdminReason: product.deletedByAdminReason,
            createdAt: product.createdAt,
            moderation: {
                status: product.status,
                reason: product.rejectionReason,
                reviewedBy: product.approvedById,
                reviewedAt: product.approvedAt,
            },
        };
    }
    async setProductListingPrice(productId, adminListingPrice, actorId) {
        const product = await prisma.product.update({
            where: { id: productId },
            data: {
                adminListingPrice,
                priceApprovedAt: new Date(),
                priceApprovedById: actorId,
            },
        });
        return {
            id: product.id,
            title: product.title,
            sellerId: product.sellerId,
            sellerEmail: null,
            categoryId: product.categoryId,
            categoryName: null,
            audience: product.audience,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
            priceApprovedAt: product.priceApprovedAt,
            priceApprovedById: product.priceApprovedById,
            status: product.status,
            rejectionReason: product.rejectionReason,
            approvedAt: product.approvedAt,
            approvedById: product.approvedById,
            isPublished: product.isPublished,
            deletedByAdmin: product.deletedByAdmin,
            deletedByAdminAt: product.deletedByAdminAt,
            deletedByAdminReason: product.deletedByAdminReason,
            createdAt: product.createdAt,
            moderation: {
                status: product.status,
                reason: product.rejectionReason,
                reviewedBy: product.approvedById,
                reviewedAt: product.approvedAt,
            },
        };
    }
    async findProductPricingOverview(params) {
        const { skip, take } = resolvePagination(params);
        const products = await prisma.product.findMany({
            where: { deletedByAdmin: false },
            include: {
                seller: {
                    select: {
                        email: true,
                        seller_profiles: {
                            select: {
                                store_name: true,
                            },
                        },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
            skip,
            take,
        });
        return products.map((product) => {
            const sellerPrice = Number(product.sellerPrice);
            const adminPrice = product.adminListingPrice == null ? null : Number(product.adminListingPrice);
            const margin = adminPrice == null ? null : adminPrice - sellerPrice;
            const marginPercentage = margin == null || sellerPrice <= 0 ? null : (margin / sellerPrice) * 100;
            return {
                productId: product.id,
                title: product.title,
                sellerId: product.sellerId,
                sellerName: product.seller?.seller_profiles?.store_name ?? null,
                sellerEmail: product.seller?.email ?? null,
                sellerPrice,
                adminListingPrice: adminPrice,
                margin,
                marginPercentage,
                status: product.status,
                image: product.images?.[0] ?? null,
                updatedAt: product.updatedAt,
            };
        });
    }
    async getProfitAnalytics(params) {
        const cached = getMemCache('profit_analytics');
        if (cached)
            return cached;
        const whereDateClause = params?.startDate || params?.endDate
            ? ` AND o."created_at" BETWEEN $1::timestamp AND $2::timestamp`
            : '';
        const queryParams = params?.startDate || params?.endDate
            ? [params.startDate ?? new Date('1970-01-01T00:00:00Z'), params.endDate ?? new Date()]
            : [];
        const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(params?.limit ?? DEFAULT_LIMIT)));
        const [totalsRows, productRows, sellerRows] = await Promise.all([
            prisma.$queryRawUnsafe(`SELECT
                    COALESCE(SUM(COALESCE(oi."admin_price_snapshot", oi."price_snapshot") * oi."quantity"), 0) AS "totalPlatformRevenue",
                    COALESCE(SUM(COALESCE(oi."seller_price_snapshot", oi."price_snapshot") * oi."quantity"), 0) AS "totalSellerPayout",
                    COALESCE(SUM(COALESCE(oi."platform_margin", COALESCE(oi."admin_price_snapshot", oi."price_snapshot") - COALESCE(oi."seller_price_snapshot", oi."price_snapshot")) * oi."quantity"), 0) AS "totalMarginEarned"
                 FROM "order_items" oi
                 INNER JOIN "orders" o ON o."id" = oi."order_id"
                 WHERE o."status" IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')${whereDateClause}`, ...queryParams),
            prisma.$queryRawUnsafe(`SELECT
                    oi."product_id" AS "productId",
                    COALESCE(p."title", 'Untitled product') AS "title",
                    COALESCE(SUM(COALESCE(oi."platform_margin", COALESCE(oi."admin_price_snapshot", oi."price_snapshot") - COALESCE(oi."seller_price_snapshot", oi."price_snapshot")) * oi."quantity"), 0) AS "margin",
                    COALESCE(SUM(oi."quantity"), 0) AS "soldUnits"
                 FROM "order_items" oi
                 INNER JOIN "orders" o ON o."id" = oi."order_id"
                 LEFT JOIN "products" p ON p."id" = oi."product_id"
                 WHERE o."status" IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')${whereDateClause}
                 GROUP BY oi."product_id", p."title"
                 ORDER BY "margin" DESC
                 LIMIT ${limit}`, ...queryParams),
            prisma.$queryRawUnsafe(`SELECT
                    oi."seller_id" AS "sellerId",
                    COALESCE(SUM(COALESCE(oi."platform_margin", COALESCE(oi."admin_price_snapshot", oi."price_snapshot") - COALESCE(oi."seller_price_snapshot", oi."price_snapshot")) * oi."quantity"), 0) AS "margin",
                    COALESCE(SUM(oi."quantity"), 0) AS "soldUnits"
                 FROM "order_items" oi
                 INNER JOIN "orders" o ON o."id" = oi."order_id"
                 WHERE o."status" IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')${whereDateClause}
                 GROUP BY oi."seller_id"
                 ORDER BY "margin" DESC
                 LIMIT ${limit}`, ...queryParams),
        ]);
        const totals = totalsRows[0] ?? {
            totalPlatformRevenue: 0,
            totalSellerPayout: 0,
            totalMarginEarned: 0,
        };
        const sellerIds = sellerRows.map((row) => row.sellerId);
        const sellers = sellerIds.length
            ? await prisma.user.findMany({
                where: { id: { in: sellerIds } },
                select: {
                    id: true,
                    email: true,
                    seller_profiles: {
                        select: {
                            store_name: true,
                        },
                    },
                },
            })
            : [];
        const sellerLookup = new Map(sellers.map((seller) => [seller.id, seller]));
        const result = {
            totalPlatformRevenue: Number(totals.totalPlatformRevenue ?? 0),
            totalSellerPayout: Number(totals.totalSellerPayout ?? 0),
            totalMarginEarned: Number(totals.totalMarginEarned ?? 0),
            profitPerProduct: productRows.map((row) => ({
                productId: row.productId,
                title: row.title,
                margin: Number(row.margin ?? 0),
                soldUnits: Number(row.soldUnits ?? 0),
            })),
            profitPerSeller: sellerRows.map((row) => {
                const seller = sellerLookup.get(row.sellerId);
                return {
                    sellerId: row.sellerId,
                    sellerEmail: seller?.email ?? null,
                    sellerName: seller?.seller_profiles?.store_name ?? null,
                    margin: Number(row.margin ?? 0),
                    soldUnits: Number(row.soldUnits ?? 0),
                };
            }),
        };
        setMemCache('profit_analytics', result, PROFIT_CACHE_TTL_MS);
        return result;
    }
    // =========================================================================
    // ORDER MANAGEMENT
    // =========================================================================
    /**
     * Find all orders
     */
    async findAllOrders(params) {
        const { skip, take } = resolvePagination(params);
        const createdAtFilter = params?.startDate || params?.endDate
            ? {
                ...(params.startDate ? { gte: params.startDate } : {}),
                ...(params.endDate ? { lte: params.endDate } : {}),
            }
            : undefined;
        const orders = await prisma.order.findMany({
            where: {
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
            },
            select: {
                id: true,
                userId: true,
                status: true,
                totalAmount: true,
                shippingName: true,
                shippingPhone: true,
                shippingEmail: true,
                shippingAddressLine1: true,
                shippingAddressLine2: true,
                shippingCity: true,
                shippingPincode: true,
                shippingNotes: true,
                createdAt: true,
                items: {
                    select: {
                        id: true,
                        sellerId: true,
                        productId: true,
                        variantId: true,
                        quantity: true,
                        priceSnapshot: true,
                        sellerPriceSnapshot: true,
                        adminPriceSnapshot: true,
                        platformMargin: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        });
        return this.enrichOrders(orders);
    }
    /**
     * Find order by ID
     */
    async findOrderById(id) {
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                items: true,
            },
        });
        if (!order)
            return null;
        const enriched = await this.enrichOrders([order]);
        return enriched[0] ?? null;
    }
    /**
     * Update order status
     */
    async updateOrderStatus(id, status) {
        const order = await prisma.order.update({
            where: { id },
            data: { status },
            include: {
                items: true,
            },
        });
        const enriched = await this.enrichOrders([order]);
        return enriched[0];
    }
    async enrichOrders(orders) {
        if (orders.length === 0)
            return [];
        const userIds = [...new Set(orders.map((order) => order.userId))];
        const allItems = orders.flatMap((order) => order.items);
        const sellerIds = [...new Set(allItems.map((item) => item.sellerId))];
        const productIds = [...new Set(allItems.map((item) => item.productId))];
        const variantIds = [...new Set(allItems.map((item) => item.variantId))];
        const [buyers, sellers, products, variants] = await Promise.all([
            userIds.length
                ? prisma.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, email: true, phone: true },
                })
                : [],
            sellerIds.length
                ? prisma.user.findMany({
                    where: { id: { in: sellerIds } },
                    select: {
                        id: true,
                        email: true,
                        seller_profiles: {
                            select: { store_name: true },
                        },
                    },
                })
                : [],
            productIds.length
                ? prisma.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, title: true },
                })
                : [],
            variantIds.length
                ? prisma.productVariant.findMany({
                    where: { id: { in: variantIds } },
                    select: { id: true, sku: true },
                })
                : [],
        ]);
        const buyerMap = new Map(buyers.map((user) => [user.id, user]));
        const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));
        const productMap = new Map(products.map((product) => [product.id, product]));
        const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
        return orders.map((order) => ({
            id: order.id,
            userId: order.userId,
            buyerEmail: buyerMap.get(order.userId)?.email ?? null,
            buyerPhone: buyerMap.get(order.userId)?.phone ?? null,
            status: order.status,
            totalAmount: order.totalAmount,
            shippingName: order.shippingName,
            shippingPhone: order.shippingPhone,
            shippingEmail: order.shippingEmail,
            shippingAddressLine1: order.shippingAddressLine1,
            shippingAddressLine2: order.shippingAddressLine2,
            shippingCity: order.shippingCity,
            shippingPincode: order.shippingPincode,
            shippingNotes: order.shippingNotes,
            createdAt: order.createdAt,
            items: order.items.map((item) => ({
                id: item.id,
                sellerId: item.sellerId,
                sellerEmail: sellerMap.get(item.sellerId)?.email ?? null,
                sellerName: sellerMap.get(item.sellerId)?.seller_profiles?.store_name ?? null,
                productId: item.productId,
                productTitle: productMap.get(item.productId)?.title ?? null,
                variantId: item.variantId,
                variantSku: variantMap.get(item.variantId)?.sku ?? null,
                quantity: item.quantity,
                priceSnapshot: item.priceSnapshot,
                sellerPriceSnapshot: item.sellerPriceSnapshot,
                adminPriceSnapshot: item.adminPriceSnapshot,
                platformMargin: item.platformMargin,
            })),
        }));
    }
    // =========================================================================
    // PAYMENTS & SETTLEMENTS
    // =========================================================================
    /**
     * Find all payments
     */
    async findAllPayments(params) {
        const { skip, take } = resolvePagination(params);
        const payments = await prisma.payment.findMany({
            orderBy: { createdAt: 'desc' },
            skip,
            take,
            select: {
                id: true,
                orderId: true,
                userId: true,
                amount: true,
                currency: true,
                status: true,
                provider: true,
                providerPaymentId: true,
                createdAt: true,
            },
        });
        return payments.map((p) => ({
            id: p.id,
            orderId: p.orderId,
            userId: p.userId,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            provider: p.provider,
            providerPaymentId: p.providerPaymentId,
            createdAt: p.createdAt,
        }));
    }
    /**
     * Find all settlements
     */
    async findAllSettlements(params) {
        const { skip, take } = resolvePagination(params);
        const settlements = await prisma.sellerSettlement.findMany({
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        });
        return settlements.map((s) => ({
            id: s.id,
            orderId: s.orderId,
            sellerId: s.sellerId,
            grossAmount: s.grossAmount,
            commissionAmount: s.commissionAmount,
            platformFee: s.platformFee,
            netAmount: s.netAmount,
            status: s.status,
            settledAt: s.settledAt,
            createdAt: s.createdAt,
        }));
    }
}
// Export singleton instance
export const adminRepository = new AdminRepository();
//# sourceMappingURL=admin.repository.js.map