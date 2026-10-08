/**
 * Admin Service
 * Business logic for admin panel operations
 */
import { adminRepository, } from '../repositories/admin.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { variantRepository } from '../repositories/variant.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { auditService } from './audit.service.js';
import { ApiError } from '../errors/ApiError.js';
import { getFromCache, setCache, CACHE_KEYS, invalidateCache, invalidateCacheByPattern, invalidateProductCaches, } from '../utils/cache.util.js';
import { notificationService } from '../notifications/notification.service.js';
import { bestsellerService } from './bestseller.service.js';
import { occasionService } from './occasion.service.js';
import { applyColorScopedHex, applyColorScopedImages, arraysEqual, normalizeVariantColorKey, resolveColorScopedGallery, sanitizeColorHex, sanitizeVariantImages, } from './color-variant-images.service.js';
import { calculateMargin } from '../utils/pricing.util.js';
import { adminLogger } from '../config/logger.js';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, orderTag, productTag } from '../live/cache-tags.js';
/**
 * Admin Service Class
 * Handles all admin panel business logic with audit logging
 */
export class AdminService {
    adminRepo;
    auditSvc;
    constructor(adminRepo, auditSvc) {
        this.adminRepo = adminRepo;
        this.auditSvc = auditSvc;
    }
    // =========================================================================
    // DASHBOARD STATS
    // =========================================================================
    /**
     * Lightweight counts for the admin dashboard.
     * Uses COUNT queries instead of fetching entire collections.
     */
    async getStats() {
        const cached = await getFromCache(CACHE_KEYS.ADMIN_STATS);
        if (cached) {
            return cached;
        }
        const [stats, recentSellers, recentProducts] = await Promise.all([
            this.adminRepo.getStats(),
            this.adminRepo.findRecentSellers(5),
            this.adminRepo.findRecentProducts(5),
        ]);
        const response = { stats, recentSellers, recentProducts };
        await setCache(CACHE_KEYS.ADMIN_STATS, response, 30);
        return response;
    }
    // =========================================================================
    // SELLER MANAGEMENT
    // =========================================================================
    /**
     * List all sellers
     */
    async listSellers(params) {
        const sellers = await this.adminRepo.findAllSellers(params);
        return { sellers };
    }
    /**
     * Approve a pending seller
     */
    async approveSeller(sellerId, actorId) {
        // Find seller
        const seller = await this.adminRepo.findSellerById(sellerId);
        if (!seller) {
            throw ApiError.notFound('Seller not found');
        }
        // Check if seller is pending
        if (seller.status !== 'PENDING') {
            throw ApiError.badRequest('Seller is not pending approval');
        }
        // Update status to ACTIVE
        const updatedSeller = await this.adminRepo.updateSellerStatus(sellerId, 'ACTIVE');
        // Fire side-effects in parallel (no data dependency)
        await Promise.all([
            notificationService.notifySellerApproved(updatedSeller.id, updatedSeller.email),
            invalidateCache(CACHE_KEYS.ADMIN_STATS),
            this.auditSvc.logAction(actorId, 'SELLER_APPROVED', 'USER', sellerId, {
                previousStatus: seller.status,
                newStatus: 'ACTIVE',
            }),
        ]);
        return {
            message: 'Seller approved successfully',
            seller: updatedSeller,
        };
    }
    /**
     * Suspend a seller
     */
    async suspendSeller(sellerId, actorId) {
        // Find seller
        const seller = await this.adminRepo.findSellerById(sellerId);
        if (!seller) {
            throw ApiError.notFound('Seller not found');
        }
        // Check if seller is active
        if (seller.status === 'SUSPENDED') {
            throw ApiError.badRequest('Seller is already suspended');
        }
        // Update status to SUSPENDED
        const updatedSeller = await this.adminRepo.updateSellerStatus(sellerId, 'SUSPENDED');
        // Log audit action
        await this.auditSvc.logAction(actorId, 'SELLER_SUSPENDED', 'USER', sellerId, {
            previousStatus: seller.status,
            newStatus: 'SUSPENDED',
        });
        await invalidateCache(CACHE_KEYS.ADMIN_STATS);
        return {
            message: 'Seller suspended successfully',
            seller: updatedSeller,
        };
    }
    // =========================================================================
    // PRODUCT MODERATION
    // =========================================================================
    /**
     * List products pending moderation
     */
    async listPendingProducts(params) {
        const products = await this.adminRepo.findPendingProducts(params);
        return { products };
    }
    /**
     * List all products (admin table view)
     */
    /**
     * Admin product list.
     *
     * Cached because this is the slowest screen in the dashboard: Prisma expands the
     * seller / seller_profiles / category / occasions / variants / inventory includes
     * into seven separate statements, and against a cross-region database that cost
     * seconds on EVERY view — including simply navigating back to the list.
     *
     * The key deliberately sits under the `products:list:` prefix, which
     * invalidateProductCaches() already wipes. Every admin mutation (approve, reject,
     * delete, price update) calls it, so an admin still sees their own change
     * immediately rather than a stale row.
     */
    async listAllProducts(params) {
        const page = params?.page ?? 1;
        const limit = params?.limit ?? 20;
        const cacheKey = `products:list:admin:${page}:${limit}:${params?.audience ?? '_'}`;
        const cached = await getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const products = await this.adminRepo.findAllProducts(params);
        const response = { products };
        await setCache(cacheKey, response, 300);
        return response;
    }
    /**
     * Approve a product
     */
    async approveProduct(productId, actorId) {
        // Find product
        const product = await this.adminRepo.findProductById(productId);
        if (!product) {
            throw ApiError.notFound('Product not found');
        }
        if (product.deletedByAdmin) {
            throw ApiError.badRequest('Deleted products cannot be approved');
        }
        const pendingVariants = (product.variants ?? []).filter((variant) => variant.status === 'PENDING');
        if (pendingVariants.length === 0 && product.status === 'APPROVED') {
            throw ApiError.badRequest('Product is already approved');
        }
        const approvedAt = new Date();
        await Promise.all(pendingVariants.map((variant) => variantRepository.update(variant.id, {
            status: 'APPROVED',
            rejectionReason: null,
            approvedAt,
            approvedById: actorId,
        })));
        await this.adminRepo.updateProductModeration(productId, 'APPROVED', actorId);
        await productRepository.syncVariantSummary(productId);
        const updatedProduct = await this.adminRepo.findProductById(productId);
        if (!updatedProduct) {
            throw ApiError.internal('Unable to reload product after approval');
        }
        // Fire side-effects in parallel
        await Promise.all([
            notificationService.notifySellerProductApproved(product.sellerId, product.title, product.sellerEmail),
            invalidateProductCaches(productId),
            invalidateCache(CACHE_KEYS.ADMIN_STATS),
            invalidateCacheByPattern('admin:profit:*'),
            this.auditSvc.logAction(actorId, 'PRODUCT_APPROVED', 'PRODUCT', productId, {
                productTitle: product.title,
            }),
        ]);
        // Fire-and-forget: cache-freshness fan-out is a background concern, and making
        // the admin's save wait on it added round-trips to an already slow request.
        void dispatchFreshness({
            type: 'product.updated',
            entityId: productId,
            tags: [
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                CACHE_TAGS.sellerProducts,
                CACHE_TAGS.adminProducts,
                productTag(productId),
            ],
            audience: { allAuthenticated: true },
        }).catch((error) => {
            adminLogger.warn({ productId, error }, 'product_update_freshness_dispatch_failed');
        });
        return {
            message: 'Product approved',
            product: updatedProduct,
        };
    }
    /**
     * Reject a product
     */
    async rejectProduct(productId, reason, actorId) {
        // Find product
        const product = await this.adminRepo.findProductById(productId);
        if (!product) {
            throw ApiError.notFound('Product not found');
        }
        if (product.deletedByAdmin) {
            throw ApiError.badRequest('Deleted products cannot be moderated');
        }
        if (!reason.trim()) {
            throw ApiError.badRequest('Rejection reason is required');
        }
        const pendingOrApprovedVariants = (product.variants ?? []).filter((variant) => variant.status === 'PENDING');
        await Promise.all(pendingOrApprovedVariants.map((variant) => variantRepository.update(variant.id, {
            status: 'REJECTED',
            rejectionReason: reason.trim(),
            approvedAt: null,
            approvedById: actorId,
            adminListingPrice: null,
        })));
        await this.adminRepo.updateProductModeration(productId, 'REJECTED', actorId, reason.trim());
        await productRepository.syncVariantSummary(productId);
        const updatedProduct = await this.adminRepo.findProductById(productId);
        if (!updatedProduct) {
            throw ApiError.internal('Unable to reload product after rejection');
        }
        // Fire side-effects in parallel
        await Promise.all([
            notificationService.notifySellerProductRejected(product.sellerId, product.title, reason.trim(), product.sellerEmail),
            invalidateProductCaches(productId),
            invalidateCache(CACHE_KEYS.ADMIN_STATS),
            invalidateCacheByPattern('admin:profit:*'),
            this.auditSvc.logAction(actorId, 'PRODUCT_REJECTED', 'PRODUCT', productId, {
                productTitle: product.title,
                reason,
            }),
        ]);
        await dispatchFreshness({
            type: 'product.updated',
            entityId: productId,
            tags: [
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                CACHE_TAGS.sellerProducts,
                CACHE_TAGS.adminProducts,
                productTag(productId),
            ],
            audience: { allAuthenticated: true },
        });
        return {
            message: 'Product rejected',
            product: updatedProduct,
        };
    }
    /**
     * Delete product by admin (soft delete)
     */
    async deleteProduct(productId, actorId, reason) {
        const product = await this.adminRepo.findProductById(productId);
        if (!product) {
            throw ApiError.notFound('Product not found');
        }
        const deleted = await this.adminRepo.markProductDeletedByAdmin(productId, reason);
        // Fire side-effects in parallel
        await Promise.all([
            invalidateProductCaches(productId),
            bestsellerService.removeByProductId(productId),
            invalidateCache(CACHE_KEYS.ADMIN_STATS),
            invalidateCacheByPattern('admin:profit:*'),
            this.auditSvc.logAction(actorId, 'PRODUCT_DELETED', 'PRODUCT', productId, {
                productTitle: product.title,
                reason: reason ?? 'Deleted by admin',
            }),
        ]);
        await dispatchFreshness({
            type: 'product.updated',
            entityId: productId,
            tags: [
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                CACHE_TAGS.sellerProducts,
                CACHE_TAGS.adminProducts,
                productTag(productId),
            ],
            audience: { allAuthenticated: true },
        });
        return {
            message: 'Product deleted by admin',
            product: deleted,
        };
    }
    async setProductPrice(productId, adminListingPrice, actorId) {
        const product = await this.adminRepo.findProductById(productId);
        if (!product) {
            throw ApiError.notFound('Product not found');
        }
        if (product.deletedByAdmin) {
            throw ApiError.badRequest('Deleted products cannot be priced');
        }
        const sellerPrice = Number(product.sellerPrice ?? 0);
        if (adminListingPrice < sellerPrice) {
            throw ApiError.badRequest('Admin listing price must be greater than or equal to seller price');
        }
        const now = new Date();
        const variants = product.variants ?? [];
        for (const variant of variants) {
            if (adminListingPrice < Number(variant.sellerPrice ?? sellerPrice)) {
                throw ApiError.badRequest(`Admin listing price must be greater than or equal to seller price for variant ${variant.sku}`);
            }
        }
        await Promise.all(variants.map((variant) => variantRepository.update(variant.id, {
            adminListingPrice,
            status: 'APPROVED',
            rejectionReason: null,
            approvedAt: now,
            approvedById: actorId,
        })));
        await this.adminRepo.updateProductModeration(productId, 'APPROVED', actorId);
        await productRepository.syncVariantSummary(productId);
        const { margin, percentage } = calculateMargin(sellerPrice, adminListingPrice);
        // Fire side-effects in parallel
        await Promise.all([
            invalidateProductCaches(productId),
            invalidateCache(CACHE_KEYS.ADMIN_STATS),
            invalidateCacheByPattern('admin:profit:*'),
            this.auditSvc.logAction(actorId, 'PRODUCT_PRICE_SET', 'PRODUCT', productId, {
                productTitle: product.title,
                sellerPrice,
                adminListingPrice,
                margin,
                marginPercentage: percentage,
            }),
        ]);
        await dispatchFreshness({
            type: 'product.updated',
            entityId: productId,
            tags: [
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                CACHE_TAGS.sellerProducts,
                CACHE_TAGS.adminProducts,
                productTag(productId),
            ],
            audience: { allAuthenticated: true },
        });
        return {
            sellerPrice,
            adminListingPrice,
            margin,
            marginPercentage: percentage,
        };
    }
    async updateProductDetails(productId, actorId, payload) {
        const [product, categoryExists] = await Promise.all([
            this.adminRepo.findProductById(productId),
            payload.categoryId
                ? categoryRepository.existsAndActive(payload.categoryId)
                : Promise.resolve(true),
        ]);
        if (!product) {
            throw ApiError.notFound('Product not found');
        }
        if (product.deletedByAdmin) {
            throw ApiError.badRequest('Deleted products cannot be updated');
        }
        if (!categoryExists) {
            throw ApiError.badRequest('Invalid category ID');
        }
        const updatePayload = {};
        const updatedFields = [];
        if (payload.categoryId !== undefined) {
            updatePayload.categoryId = payload.categoryId;
            updatedFields.push('categoryId');
        }
        if (payload.title !== undefined) {
            updatePayload.title = payload.title;
            updatedFields.push('title');
        }
        if (payload.description !== undefined) {
            updatePayload.description = payload.description;
            updatedFields.push('description');
        }
        if (payload.images !== undefined) {
            updatePayload.images = payload.images;
            updatedFields.push('images');
        }
        if (payload.isPublished !== undefined) {
            updatePayload.isPublished = payload.isPublished;
            updatedFields.push('isPublished');
        }
        if (payload.occasionIds !== undefined) {
            updatedFields.push('occasionIds');
        }
        const workingVariants = (product.variants ?? []).map((variant) => ({
            id: variant.id,
            size: variant.size ?? 'Default',
            color: variant.color ?? null,
            colorHex: sanitizeColorHex(variant.colorHex),
            images: sanitizeVariantImages(variant.images ?? []),
            sku: variant.sku,
            sellerPrice: Number(variant.sellerPrice ?? 0),
            adminListingPrice: variant.adminListingPrice == null ? null : Number(variant.adminListingPrice),
            compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
            status: variant.status,
        }));
        const variantUpdates = [];
        // Writes are collected here and flushed in one batch below. Issuing them
        // inside the loop cost two sequential round trips per variant.
        const variantWrites = [];
        const stockWrites = [];
        if (payload.variants && payload.variants.length > 0) {
            for (const variantInput of payload.variants) {
                const variant = workingVariants.find((entry) => entry.id === variantInput.id);
                if (!variant) {
                    throw ApiError.badRequest('One or more variant updates are invalid');
                }
                const currentColor = variant.color ?? null;
                const nextColor = variantInput.color !== undefined ? variantInput.color : currentColor;
                const siblingVariants = workingVariants.filter((entry) => entry.id !== variantInput.id);
                const inferredImages = variantInput.images !== undefined
                    ? sanitizeVariantImages(variantInput.images)
                    : (() => {
                        const inherited = resolveColorScopedGallery(siblingVariants, nextColor);
                        if (inherited.length > 0) {
                            return inherited;
                        }
                        if (normalizeVariantColorKey(currentColor) === normalizeVariantColorKey(nextColor)) {
                            return sanitizeVariantImages(variant.images);
                        }
                        return [];
                    })();
                const variantPayload = {
                    images: inferredImages,
                };
                if (variantInput.size !== undefined) {
                    variantPayload.size = variantInput.size;
                }
                if (variantInput.color !== undefined) {
                    variantPayload.color = variantInput.color;
                }
                if (variantInput.colorHex !== undefined) {
                    variantPayload.colorHex = sanitizeColorHex(variantInput.colorHex);
                }
                if (variantInput.sku !== undefined) {
                    variantPayload.sku = variantInput.sku;
                }
                if (variantInput.sellerPrice !== undefined) {
                    variantPayload.sellerPrice = variantInput.sellerPrice;
                }
                if (variantInput.adminListingPrice !== undefined) {
                    variantPayload.adminListingPrice = variantInput.adminListingPrice;
                }
                if (variantInput.compareAtPrice !== undefined) {
                    variantPayload.compareAtPrice = variantInput.compareAtPrice;
                }
                if (variantInput.status !== undefined) {
                    variantPayload.status = variantInput.status;
                    variantPayload.rejectionReason =
                        variantInput.status === 'REJECTED'
                            ? variantInput.rejectionReason ?? 'Rejected by admin'
                            : null;
                    variantPayload.approvedAt = variantInput.status === 'APPROVED' ? new Date() : null;
                    variantPayload.approvedById = actorId;
                }
                const nextSellerPrice = variantInput.sellerPrice ?? variant.sellerPrice;
                const nextAdminListingPrice = variantInput.adminListingPrice !== undefined
                    ? variantInput.adminListingPrice
                    : variant.adminListingPrice;
                if (nextAdminListingPrice !== null &&
                    nextAdminListingPrice !== undefined &&
                    nextAdminListingPrice < nextSellerPrice) {
                    throw ApiError.badRequest(`Admin listing price cannot be lower than seller price for variant ${variant.sku}`);
                }
                const effectivePrice = nextAdminListingPrice ?? nextSellerPrice;
                const currentEffectivePrice = variant.adminListingPrice ?? variant.sellerPrice;
                const nextCompareAt = variantInput.compareAtPrice !== undefined
                    ? variantInput.compareAtPrice
                    : variant.compareAtPrice;
                // Only enforced when this request actually moves one of the two
                // numbers. Approving a variant sets the listing price without this
                // check, so a stored compare-at can end up at or below it — and
                // re-validating untouched values then locked the admin out of the
                // listing entirely, including edits to stock or images.
                const priceRelationChanged = nextCompareAt !== variant.compareAtPrice ||
                    effectivePrice !== currentEffectivePrice;
                if (priceRelationChanged &&
                    nextCompareAt !== null &&
                    nextCompareAt !== undefined &&
                    nextCompareAt < effectivePrice) {
                    throw ApiError.badRequest(`Compare-at price for ${variant.sku} cannot be below its selling price of ${effectivePrice}`);
                }
                variantWrites.push({
                    id: variantInput.id,
                    data: variantPayload,
                    current: {
                        sellerPrice: variant.sellerPrice,
                        adminListingPrice: variant.adminListingPrice,
                    },
                });
                if (variantInput.stock !== undefined) {
                    stockWrites.push({ variantId: variantInput.id, stock: variantInput.stock });
                }
                const workingIndex = workingVariants.findIndex((entry) => entry.id === variantInput.id);
                if (workingIndex >= 0) {
                    const currentWorking = workingVariants[workingIndex];
                    if (!currentWorking) {
                        throw ApiError.badRequest('One or more variant updates are invalid');
                    }
                    workingVariants[workingIndex] = {
                        ...currentWorking,
                        id: currentWorking.id,
                        size: variantInput.size ?? currentWorking.size,
                        color: nextColor ?? null,
                        colorHex: variantInput.colorHex !== undefined
                            ? sanitizeColorHex(variantInput.colorHex)
                            : currentWorking.colorHex,
                        images: inferredImages,
                        sku: variantInput.sku ?? currentWorking.sku,
                        sellerPrice: variantInput.sellerPrice ?? currentWorking.sellerPrice,
                        adminListingPrice: variantInput.adminListingPrice !== undefined
                            ? variantInput.adminListingPrice
                            : currentWorking.adminListingPrice,
                        compareAtPrice: variantInput.compareAtPrice !== undefined
                            ? variantInput.compareAtPrice
                            : currentWorking.compareAtPrice,
                        status: variantInput.status ?? currentWorking.status,
                    };
                }
                variantUpdates.push(variantInput.id);
            }
            const normalizedVariants = applyColorScopedImages(workingVariants);
            for (const normalizedVariant of normalizedVariants) {
                const currentVariant = workingVariants.find((entry) => entry.id === normalizedVariant.id);
                if (!currentVariant || arraysEqual(currentVariant.images, normalizedVariant.images)) {
                    continue;
                }
                const pendingWrite = variantWrites.find((entry) => entry.id === normalizedVariant.id);
                if (pendingWrite) {
                    pendingWrite.data.images = normalizedVariant.images;
                }
                else {
                    variantWrites.push({
                        id: normalizedVariant.id,
                        data: { images: normalizedVariant.images },
                        current: {
                            sellerPrice: currentVariant.sellerPrice,
                            adminListingPrice: currentVariant.adminListingPrice,
                        },
                    });
                }
                currentVariant.images = normalizedVariant.images;
            }
            // A swatch belongs to the colour, so picking one on any size applies
            // it to every size of that colour — same rule as the galleries above.
            for (const normalizedVariant of applyColorScopedHex(workingVariants)) {
                const currentVariant = workingVariants.find((entry) => entry.id === normalizedVariant.id);
                if (!currentVariant || currentVariant.colorHex === normalizedVariant.colorHex) {
                    continue;
                }
                const pendingWrite = variantWrites.find((entry) => entry.id === normalizedVariant.id);
                if (pendingWrite) {
                    pendingWrite.data.colorHex = normalizedVariant.colorHex;
                }
                else {
                    variantWrites.push({
                        id: normalizedVariant.id,
                        data: { colorHex: normalizedVariant.colorHex },
                        current: {
                            sellerPrice: currentVariant.sellerPrice,
                            adminListingPrice: currentVariant.adminListingPrice,
                        },
                    });
                }
                currentVariant.colorHex = normalizedVariant.colorHex;
            }
        }
        const writes = [
            variantRepository.updateMany(variantWrites),
            inventoryRepository.setStockMany(stockWrites),
        ];
        if (payload.occasionIds !== undefined) {
            writes.push(occasionService.syncProductOccasions(productId, payload.occasionIds ?? []));
        }
        if (Object.keys(updatePayload).length > 0) {
            writes.push(productRepository.update(productId, updatePayload));
        }
        await Promise.all(writes);
        await productRepository.syncVariantSummary(productId);
        // The admin list is served from cache, so its invalidation has to land
        // before the client refetches. Everything else is broadcast/analytics work
        // that no longer holds the response open.
        const [refreshed] = await Promise.all([
            this.adminRepo.findProductById(productId),
            invalidateProductCaches(productId),
        ]);
        if (!refreshed) {
            throw ApiError.internal('Unable to reload product after updates');
        }
        void Promise.allSettled([
            invalidateCache(CACHE_KEYS.ADMIN_STATS),
            invalidateCacheByPattern('admin:profit:*'),
            dispatchFreshness({
                type: 'product.updated',
                entityId: productId,
                tags: [
                    CACHE_TAGS.products,
                    CACHE_TAGS.search,
                    CACHE_TAGS.sellerProducts,
                    CACHE_TAGS.adminProducts,
                    productTag(productId),
                ],
                audience: { allAuthenticated: true },
            }),
        ]);
        // Audit trail — written asynchronously so it never sits on the save path.
        void this.auditSvc
            .logAction(actorId, 'PRODUCT_UPDATED', 'PRODUCT', productId, {
            productTitle: product.title,
            updatedFields,
            variantUpdates,
        })
            .catch((error) => {
            adminLogger.warn({ productId, actorId, error }, 'product_update_audit_log_failed');
        });
        return {
            message: 'Product updated successfully',
            product: refreshed,
        };
    }
    async pricingOverview(params) {
        const products = await this.adminRepo.findProductPricingOverview(params);
        return { products };
    }
    async profitAnalytics(params) {
        const cacheKey = CACHE_KEYS.ADMIN_PROFIT_SUMMARY(params?.startDate?.toISOString(), params?.endDate?.toISOString(), params?.limit ?? 20);
        const cached = await getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const response = await this.adminRepo.getProfitAnalytics(params);
        await setCache(cacheKey, response, 30);
        return response;
    }
    // =========================================================================
    // ORDER MANAGEMENT
    // =========================================================================
    /**
     * List all orders (with caching)
     */
    async listOrders(params) {
        const page = params?.page ?? 1;
        const limit = params?.limit ?? 20;
        const shouldUseCache = page === 1 && limit === 20 && !params?.startDate && !params?.endDate;
        // Try cache first
        const cached = shouldUseCache
            ? await getFromCache(CACHE_KEYS.ADMIN_ORDERS)
            : null;
        if (cached && shouldUseCache) {
            return cached;
        }
        const orders = await this.adminRepo.findAllOrders(params);
        const response = { orders };
        // Cache the result
        if (shouldUseCache) {
            await setCache(CACHE_KEYS.ADMIN_ORDERS, response);
        }
        return response;
    }
    /**
     * Cancel an order (ADMIN can cancel non-delivered orders)
     */
    async cancelOrder(orderId, actorId) {
        // Find order
        const order = await this.adminRepo.findOrderById(orderId);
        if (!order) {
            throw ApiError.notFound('Order not found');
        }
        // Check if order can be cancelled
        if (order.status === 'DELIVERED') {
            throw ApiError.badRequest('Cannot cancel a delivered order');
        }
        if (order.status === 'CANCELLED') {
            throw ApiError.badRequest('Order is already cancelled');
        }
        // Update order status
        const updatedOrder = await this.adminRepo.updateOrderStatus(orderId, 'CANCELLED');
        // Fire side-effects in parallel
        await Promise.all([
            invalidateCache(CACHE_KEYS.ADMIN_ORDERS),
            invalidateCacheByPattern('orders:buyer:*'),
            invalidateCacheByPattern('orders:detail:*'),
            invalidateCache(CACHE_KEYS.RECOMMENDATIONS(order.userId)),
            invalidateCache(CACHE_KEYS.ADMIN_STATS),
            invalidateCacheByPattern('admin:profit:*'),
            this.auditSvc.logAction(actorId, 'ORDER_CANCELLED', 'ORDER', orderId, {
                previousStatus: order.status,
                newStatus: 'CANCELLED',
            }),
        ]);
        await dispatchFreshness({
            type: 'order.updated',
            entityId: orderId,
            tags: [CACHE_TAGS.orders, CACHE_TAGS.userOrders, CACHE_TAGS.sellerOrders, orderTag(orderId)],
            audience: { allAuthenticated: true },
        });
        return {
            message: 'Order cancelled successfully',
            order: updatedOrder,
        };
    }
    /**
     * Force confirm an order (SUPER_ADMIN only - bypasses payment)
     */
    async forceConfirmOrder(orderId, actorId) {
        // Find order
        const order = await this.adminRepo.findOrderById(orderId);
        if (!order) {
            throw ApiError.notFound('Order not found');
        }
        // Check if order can be confirmed
        if (order.status === 'CONFIRMED') {
            throw ApiError.badRequest('Order is already confirmed');
        }
        if (order.status === 'CANCELLED') {
            throw ApiError.badRequest('Cannot confirm a cancelled order');
        }
        if (order.status === 'DELIVERED') {
            throw ApiError.badRequest('Order is already delivered');
        }
        // Update order status (bypasses payment check)
        const updatedOrder = await this.adminRepo.updateOrderStatus(orderId, 'CONFIRMED');
        // Fire side-effects in parallel
        await Promise.all([
            invalidateCache(CACHE_KEYS.ADMIN_ORDERS),
            invalidateCacheByPattern('orders:buyer:*'),
            invalidateCacheByPattern('orders:detail:*'),
            invalidateCache(CACHE_KEYS.RECOMMENDATIONS(order.userId)),
            invalidateCache(CACHE_KEYS.ADMIN_STATS),
            invalidateCacheByPattern('admin:profit:*'),
            this.auditSvc.logAction(actorId, 'ORDER_FORCE_CONFIRMED', 'ORDER', orderId, {
                previousStatus: order.status,
                newStatus: 'CONFIRMED',
                bypassedPayment: true,
            }),
        ]);
        await dispatchFreshness({
            type: 'order.updated',
            entityId: orderId,
            tags: [CACHE_TAGS.orders, CACHE_TAGS.userOrders, CACHE_TAGS.sellerOrders, orderTag(orderId)],
            audience: { allAuthenticated: true },
        });
        return {
            message: 'Order force-confirmed (payment bypassed)',
            order: updatedOrder,
        };
    }
    // =========================================================================
    // PAYMENTS & SETTLEMENTS (READ-ONLY)
    // =========================================================================
    /**
     * List all payments (with caching)
     */
    async listPayments(params) {
        const page = params?.page ?? 1;
        const limit = params?.limit ?? 20;
        const shouldUseCache = page === 1 && limit === 20;
        // Try cache first
        const cached = shouldUseCache
            ? await getFromCache(CACHE_KEYS.ADMIN_PAYMENTS)
            : null;
        if (cached && shouldUseCache) {
            return cached;
        }
        const payments = await this.adminRepo.findAllPayments(params);
        const response = { payments };
        // Cache the result
        if (shouldUseCache) {
            await setCache(CACHE_KEYS.ADMIN_PAYMENTS, response);
        }
        return response;
    }
    /**
     * List all settlements
     */
    async listSettlements(params) {
        const settlements = await this.adminRepo.findAllSettlements(params);
        return { settlements };
    }
}
// Export singleton instance
export const adminService = new AdminService(adminRepository, auditService);
//# sourceMappingURL=admin.service.js.map