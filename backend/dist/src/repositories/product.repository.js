import { prisma } from '../config/db.js';
/**
 * Product Repository
 * Handles database operations for products
 */
export class ProductRepository {
    resolvePagination(page, limit) {
        const pRaw = Number(page ?? 1);
        const lRaw = Number(limit ?? 20);
        const p = Number.isFinite(pRaw) && pRaw > 0 ? Math.trunc(pRaw) : 1;
        const l = Math.min(20, Math.max(1, Number.isFinite(lRaw) ? Math.trunc(lRaw) : 20));
        return { skip: (p - 1) * l, take: l };
    }
    mapProductDecimals(product) {
        return {
            ...product,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
        };
    }
    mapVariantFields(variant) {
        return {
            ...variant,
            sellerPrice: Number(variant.sellerPrice),
            adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
            price: Number(variant.price),
            compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
        };
    }
    mapProductWithVariants(product) {
        return {
            ...this.mapProductDecimals(product),
            variants: (product.variants ?? []).map((variant) => this.mapVariantFields(variant)),
        };
    }
    async syncVariantSummary(productId, tx = prisma) {
        const product = await tx.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                deletedByAdmin: true,
                variants: {
                    select: {
                        id: true,
                        sellerPrice: true,
                        adminListingPrice: true,
                        status: true,
                        rejectionReason: true,
                        approvedAt: true,
                        approvedById: true,
                        createdAt: true,
                        price: true,
                    },
                    orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
                },
            },
        });
        if (!product) {
            throw new Error(`Product ${productId} not found while syncing variant summary`);
        }
        const approvedVariants = product.variants.filter((variant) => variant.status === 'APPROVED');
        const pendingVariants = product.variants.filter((variant) => variant.status === 'PENDING');
        const rejectedVariants = product.variants.filter((variant) => variant.status === 'REJECTED');
        const summarySource = approvedVariants[0] ?? pendingVariants[0] ?? rejectedVariants[0] ?? null;
        const nextStatus = approvedVariants.length > 0 ? 'APPROVED' : pendingVariants.length > 0 ? 'PENDING' : 'REJECTED';
        const rejectionReason = nextStatus === 'REJECTED' ? rejectedVariants[0]?.rejectionReason ?? null : null;
        const updated = await tx.product.update({
            where: { id: productId },
            data: {
                sellerPrice: summarySource?.sellerPrice ?? 0,
                adminListingPrice: approvedVariants.length > 0 ? approvedVariants[0]?.adminListingPrice ?? null : null,
                priceApprovedAt: approvedVariants.length > 0 ? approvedVariants[0]?.approvedAt ?? null : null,
                priceApprovedById: approvedVariants.length > 0 ? approvedVariants[0]?.approvedById ?? null : null,
                status: product.deletedByAdmin ? 'REJECTED' : nextStatus,
                rejectionReason: product.deletedByAdmin ? rejectionReason : rejectionReason,
                approvedAt: approvedVariants.length > 0 ? approvedVariants[0]?.approvedAt ?? null : null,
                approvedById: approvedVariants.length > 0 ? approvedVariants[0]?.approvedById ?? null : null,
                isPublished: !product.deletedByAdmin && approvedVariants.length > 0,
            },
        });
        return this.mapProductDecimals(updated);
    }
    /**
     * Find published products with pagination and filters
     */
    async findPublished(filters) {
        const { page = 1, limit = 20, categoryId, audience, search, occasion } = filters;
        const { skip, take } = this.resolvePagination(page, Math.min(limit, 20));
        const conditions = [
            `p."status" = 'APPROVED'`,
            `p."deleted_by_admin" = false`,
            `EXISTS (
                SELECT 1
                FROM "product_variants" pv_pub
                WHERE pv_pub."product_id" = p."id"
                  AND pv_pub."status" = 'APPROVED'
            )`,
        ];
        const params = [];
        let paramIndex = 1;
        if (categoryId) {
            conditions.push(`p."category_id" = $${paramIndex}`);
            params.push(categoryId);
            paramIndex += 1;
        }
        if (audience) {
            conditions.push(`p."audience" = $${paramIndex}::"ProductAudience"`);
            params.push(audience);
            paramIndex += 1;
        }
        if (search && search.trim().length > 0) {
            const pattern = `%${search.trim()}%`;
            conditions.push(`(
                p."title" ILIKE $${paramIndex}
                OR p."description" ILIKE $${paramIndex}
                OR c."name" ILIKE $${paramIndex}
                OR c."slug" ILIKE $${paramIndex}
                OR EXISTS (
                    SELECT 1
                    FROM "product_occasions" po
                    INNER JOIN "occasions" o ON o."id" = po."occasion_id"
                    WHERE po."product_id" = p."id"
                      AND o."is_active" = true
                      AND (o."name" ILIKE $${paramIndex} OR o."slug" ILIKE $${paramIndex})
                )
            )`);
            params.push(pattern);
            paramIndex += 1;
        }
        if (occasion) {
            conditions.push(`EXISTS (
                SELECT 1
                FROM "product_occasions" po
                INNER JOIN "occasions" o ON o."id" = po."occasion_id"
                WHERE po."product_id" = p."id"
                  AND o."is_active" = true
                  AND o."slug" = $${paramIndex}
            )`);
            params.push(occasion);
            paramIndex += 1;
        }
        const whereClause = conditions.join(' AND ');
        const countQuery = `
            SELECT COUNT(*)::int AS total
            FROM "products" p
            LEFT JOIN "categories" c ON c."id" = p."category_id"
            WHERE ${whereClause}
        `;
        const dataQuery = `
            SELECT
                p."id",
                p."seller_id" AS "sellerId",
                p."category_id" AS "categoryId",
                p."audience" AS "audience",
                p."title",
                p."description",
                p."images",
                p."seller_price" AS "sellerPrice",
                p."admin_listing_price" AS "adminListingPrice",
                p."price_approved_at" AS "priceApprovedAt",
                p."price_approved_by_id" AS "priceApprovedById",
                p."status",
                p."rejection_reason" AS "rejectionReason",
                p."approved_at" AS "approvedAt",
                p."approved_by_id" AS "approvedById",
                p."is_published" AS "isPublished",
                p."deleted_by_admin" AS "deletedByAdmin",
                p."deleted_by_admin_at" AS "deletedByAdminAt",
                p."deleted_by_admin_reason" AS "deletedByAdminReason",
                p."created_at" AS "createdAt",
                p."updated_at" AS "updatedAt",
                cv."price" AS "cheapestVariantPrice",
                cv."compare_at_price" AS "cheapestVariantCompareAt",
                json_build_object(
                    'id', c."id",
                    'name', c."name",
                    'slug', c."slug",
                    'isActive', c."is_active"
                ) AS "category"
            FROM "products" p
            LEFT JOIN "categories" c ON c."id" = p."category_id"
            LEFT JOIN LATERAL (
                SELECT pv."price", pv."compare_at_price"
                FROM "product_variants" pv
                WHERE pv."product_id" = p."id"
                  AND pv."status" = 'APPROVED'
                ORDER BY pv."price" ASC, pv."created_at" ASC
                LIMIT 1
            ) cv ON true
            WHERE ${whereClause}
            ORDER BY p."created_at" DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        const [countRows, rows] = await Promise.all([
            prisma.$queryRawUnsafe(countQuery, ...params),
            prisma.$queryRawUnsafe(dataQuery, ...params, take, skip),
        ]);
        const products = rows.map((product) => ({
            ...product,
            sellerPrice: Number(product.sellerPrice),
            adminListingPrice: product.adminListingPrice == null ? null : Number(product.adminListingPrice),
            cheapestVariantPrice: product.cheapestVariantPrice == null ? null : Number(product.cheapestVariantPrice),
            cheapestVariantCompareAt: product.cheapestVariantCompareAt == null ? null : Number(product.cheapestVariantCompareAt),
        }));
        return {
            products: products,
            total: countRows[0]?.total ?? 0,
        };
    }
    /**
     * Find published product by ID with full details
     */
    async findPublishedById(id) {
        const product = await prisma.product.findFirst({
            where: {
                id,
                status: 'APPROVED',
                deletedByAdmin: false,
                variants: {
                    some: {
                        status: 'APPROVED',
                    },
                },
            },
            select: {
                id: true,
                sellerId: true,
                sellerPrice: true,
                categoryId: true,
                title: true,
                description: true,
                images: true,
                status: true,
                isPublished: true,
                createdAt: true,
                updatedAt: true,
                adminListingPrice: true,
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        isActive: true,
                    },
                },
                variants: {
                    where: { status: 'APPROVED' },
                    select: {
                        id: true,
                        size: true,
                        color: true,
                        colorHex: true,
                        images: true,
                        sku: true,
                        sellerPrice: true,
                        adminListingPrice: true,
                        price: true,
                        compareAtPrice: true,
                        status: true,
                        rejectionReason: true,
                        approvedAt: true,
                        approvedById: true,
                        createdAt: true,
                        updatedAt: true,
                        inventory: true,
                    },
                    orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
                },
            },
        });
        if (!product) {
            return null;
        }
        return this.mapProductWithVariants(product);
    }
    /**
     * Find all products for a seller
     */
    async findBySellerId(sellerId, params) {
        const { skip, take } = this.resolvePagination(params?.page, params?.limit);
        const products = await prisma.product.findMany({
            where: { sellerId },
            include: {
                category: true,
                variants: {
                    include: {
                        inventory: true,
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        });
        return products.map((product) => this.mapProductWithVariants(product));
    }
    /**
     * Find product by ID and seller (ownership check)
     */
    async findByIdAndSeller(id, sellerId) {
        const product = await prisma.product.findFirst({
            where: { id, sellerId },
        });
        return product ? this.mapProductDecimals(product) : null;
    }
    /**
     * Find product by ID with details
     */
    async findByIdWithDetails(id) {
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                variants: {
                    include: {
                        inventory: true,
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
            },
        });
        return product ? this.mapProductWithVariants(product) : null;
    }
    /**
     * Create a new product with inline variants
     */
    async create(sellerId, data) {
        const sortedVariants = [...data.variants].sort((a, b) => a.sellerPrice - b.sellerPrice);
        const cheapest = sortedVariants[0];
        const product = await prisma.product.create({
            data: {
                sellerId,
                categoryId: data.categoryId,
                audience: data.audience ?? 'MENS',
                title: data.title,
                description: data.description ?? null,
                sellerPrice: cheapest?.sellerPrice ?? 0,
                adminListingPrice: null,
                priceApprovedAt: null,
                priceApprovedById: null,
                images: data.images ?? [],
                status: 'PENDING',
                rejectionReason: null,
                approvedAt: null,
                approvedById: null,
                isPublished: false,
                variants: {
                    create: data.variants.map((variant) => ({
                        size: variant.size,
                        color: variant.color?.trim() ? variant.color.trim() : null,
                        colorHex: variant.colorHex ?? null,
                        images: variant.images ?? [],
                        sku: variant.sku,
                        sellerPrice: variant.sellerPrice,
                        adminListingPrice: null,
                        price: variant.sellerPrice,
                        compareAtPrice: variant.compareAtPrice ?? null,
                        status: 'PENDING',
                        inventory: {
                            create: {
                                stock: variant.initialStock ?? 0,
                            },
                        },
                    })),
                },
            },
        });
        return this.mapProductDecimals(product);
    }
    /**
     * Update a product
     */
    async update(id, data) {
        const product = await prisma.product.update({
            where: { id },
            data: {
                ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
                ...(data.audience !== undefined && { audience: data.audience }),
                ...(data.title !== undefined && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.images !== undefined && { images: data.images }),
                ...(data.sellerPrice !== undefined && { sellerPrice: data.sellerPrice }),
                ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
            },
        });
        return this.mapProductDecimals(product);
    }
    /**
     * Delete a product
     */
    async delete(id) {
        await prisma.product.delete({
            where: { id },
        });
    }
    /**
     * Check if product exists
     */
    async exists(id) {
        const product = await prisma.product.findUnique({
            where: { id },
            select: { id: true },
        });
        return product !== null;
    }
}
// Export singleton instance
export const productRepository = new ProductRepository();
//# sourceMappingURL=product.repository.js.map