import { prisma } from '../config/db.js';
/**
 * Variant Repository
 * Handles database operations for product variants
 */
export class VariantRepository {
    normalizeColor(color) {
        return color?.trim() ? color.trim() : null;
    }
    normalizeSize(size) {
        const trimmed = size?.trim();
        return trimmed && trimmed.length > 0 ? trimmed : 'Default';
    }
    resolveEffectivePrice(input) {
        const sellerPrice = input.sellerPrice ?? input.current?.sellerPrice ?? 0;
        const adminListingPrice = input.adminListingPrice !== undefined ? input.adminListingPrice : input.current?.adminListingPrice ?? null;
        return adminListingPrice ?? sellerPrice;
    }
    /**
     * Create a variant with initial inventory
     */
    async create(productId, data) {
        const payload = {
            productId,
            size: this.normalizeSize(data.size),
            color: this.normalizeColor(data.color),
            colorHex: data.colorHex ?? null,
            images: data.images ?? [],
            sku: data.sku.trim(),
            sellerPrice: data.sellerPrice,
            adminListingPrice: null,
            price: data.sellerPrice,
            compareAtPrice: data.compareAtPrice ?? null,
            status: 'PENDING',
            rejectionReason: null,
            approvedAt: null,
            approvedById: null,
            inventory: {
                create: {
                    stock: data.initialStock ?? 0,
                },
            },
        };
        const variant = await prisma.productVariant.create({
            data: payload,
            include: {
                inventory: true,
            },
        });
        return {
            ...variant,
            sellerPrice: Number(variant.sellerPrice),
            adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
            price: Number(variant.price),
            compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
        };
    }
    /**
     * Find variant by ID
     */
    async findById(id) {
        const variant = await prisma.productVariant.findUnique({
            where: { id },
        });
        return variant
            ? {
                ...variant,
                sellerPrice: Number(variant.sellerPrice),
                adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
                price: Number(variant.price),
                compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
            }
            : null;
    }
    /**
     * Find variant by ID with inventory
     */
    async findByIdWithInventory(id) {
        const variant = await prisma.productVariant.findUnique({
            where: { id },
            include: {
                inventory: true,
            },
        });
        return variant
            ? {
                ...variant,
                sellerPrice: Number(variant.sellerPrice),
                adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
                price: Number(variant.price),
                compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
            }
            : null;
    }
    /**
     * Find variant with product and seller info (for ownership check)
     */
    async findByIdWithProduct(id) {
        const variant = await prisma.productVariant.findUnique({
            where: { id },
            select: {
                id: true,
                productId: true,
                size: true,
                color: true,
                images: true,
                sku: true,
                sellerPrice: true,
                adminListingPrice: true,
                price: true,
                status: true,
                compareAtPrice: true,
                inventory: {
                    select: {
                        stock: true,
                    },
                },
                product: {
                    select: {
                        id: true,
                        sellerId: true,
                        status: true,
                        deletedByAdmin: true,
                        adminListingPrice: true,
                    },
                },
            },
        });
        if (!variant) {
            return null;
        }
        return {
            ...variant,
            sellerPrice: Number(variant.sellerPrice),
            adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
            price: Number(variant.price),
            compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
            product: {
                ...variant.product,
                adminListingPrice: variant.product.adminListingPrice == null ? null : Number(variant.product.adminListingPrice),
            },
        };
    }
    buildUpdateData(data, current) {
        return {
            ...(data.size !== undefined && { size: this.normalizeSize(data.size) }),
            ...(data.color !== undefined && { color: this.normalizeColor(data.color) }),
            ...(data.colorHex !== undefined && { colorHex: data.colorHex }),
            ...(data.sku !== undefined && { sku: data.sku.trim() }),
            ...(data.images !== undefined && { images: data.images }),
            ...(data.sellerPrice !== undefined && { sellerPrice: data.sellerPrice }),
            ...(data.adminListingPrice !== undefined && { adminListingPrice: data.adminListingPrice }),
            ...(data.compareAtPrice !== undefined && { compareAtPrice: data.compareAtPrice }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason }),
            ...(data.approvedAt !== undefined && { approvedAt: data.approvedAt }),
            ...(data.approvedById !== undefined && { approvedById: data.approvedById }),
            price: this.resolveEffectivePrice({
                sellerPrice: data.sellerPrice,
                adminListingPrice: data.adminListingPrice,
                current,
            }),
        };
    }
    /**
     * Update several variants in one round trip. Callers pass the current prices
     * they already hold so no per-variant read is needed to resolve `price`.
     */
    async updateMany(updates) {
        if (updates.length === 0)
            return;
        await prisma.$transaction(updates.map(({ id, data, current }) => prisma.productVariant.update({
            where: { id },
            data: this.buildUpdateData(data, current),
        })));
    }
    /**
     * Update a variant
     */
    async update(id, data) {
        const current = await prisma.productVariant.findUnique({
            where: { id },
            select: {
                sellerPrice: true,
                adminListingPrice: true,
            },
        });
        if (!current) {
            throw new Error(`Variant ${id} not found`);
        }
        const variant = await prisma.productVariant.update({
            where: { id },
            data: this.buildUpdateData(data, {
                sellerPrice: Number(current.sellerPrice),
                adminListingPrice: current.adminListingPrice == null ? null : Number(current.adminListingPrice),
            }),
        });
        return {
            ...variant,
            sellerPrice: Number(variant.sellerPrice),
            adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
            price: Number(variant.price),
            compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
        };
    }
    /**
     * Check if SKU exists
     */
    async skuExists(productId, sku, excludeId) {
        const variant = await prisma.productVariant.findFirst({
            where: {
                productId,
                sku: sku.trim(),
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
            select: { id: true },
        });
        return variant !== null;
    }
    /**
     * Check if a size/color combination already exists.
     */
    async variantCombinationExists(productId, size, color, excludeId) {
        const normalizedColor = this.normalizeColor(color);
        const normalizedSize = this.normalizeSize(size);
        const variant = await prisma.productVariant.findFirst({
            where: {
                productId,
                size: {
                    equals: normalizedSize,
                    mode: 'insensitive',
                },
                color: normalizedColor === null
                    ? null
                    : {
                        equals: normalizedColor,
                        mode: 'insensitive',
                    },
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
            select: { id: true },
        });
        return variant !== null;
    }
}
// Export singleton instance
export const variantRepository = new VariantRepository();
//# sourceMappingURL=variant.repository.js.map