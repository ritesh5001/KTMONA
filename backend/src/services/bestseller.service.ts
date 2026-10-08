import { ApiError } from '../errors/ApiError.js';
import { bestsellerRepository } from '../repositories/bestseller.repository.js';
import { prisma } from '../config/db.js';
import { CACHE_KEYS, getFromCache, invalidateCache, setCache } from '../utils/cache.util.js';
import type { CouponType } from '@prisma/client';

const DEFAULT_LIMIT = 4;

interface ActiveCouponCandidate {
    code: string;
    type: CouponType;
    value: number;
    maxDiscountAmount: number | null;
    minOrderAmount: number;
    sellerId: string | null;
}

export class BestsellerService {
    private toNumber(value: unknown): number {
        if (typeof value === 'number') return value;
        return Number(value ?? 0);
    }

    private roundMoney(value: number): number {
        return Math.round(value * 100) / 100;
    }

    private calculateDiscountedPrice(price: number, coupon: ActiveCouponCandidate): number | null {
        if (!Number.isFinite(price) || price <= 0) return null;
        if (price < coupon.minOrderAmount) return null;

        let discount = coupon.type === 'PERCENT' ? (price * coupon.value) / 100 : coupon.value;
        if (coupon.maxDiscountAmount !== null) {
            discount = Math.min(discount, coupon.maxDiscountAmount);
        }

        discount = Math.max(0, discount);
        if (discount <= 0) return null;

        const discountedPrice = Math.max(0, price - discount);
        if (discountedPrice >= price) return null;
        return this.roundMoney(discountedPrice);
    }

    private getBestCouponPreview(price: number, sellerId: string, coupons: ActiveCouponCandidate[]) {
        let best: {
            code: string;
            type: CouponType;
            value: number;
            maxDiscountAmount: number | null;
            minOrderAmount: number;
            discountedPrice: number;
        } | null = null;

        for (const coupon of coupons) {
            if (coupon.sellerId && coupon.sellerId !== sellerId) continue;
            const discountedPrice = this.calculateDiscountedPrice(price, coupon);
            if (discountedPrice === null) continue;

            if (!best || discountedPrice < best.discountedPrice) {
                best = {
                    code: coupon.code,
                    type: coupon.type,
                    value: coupon.value,
                    maxDiscountAmount: coupon.maxDiscountAmount,
                    minOrderAmount: coupon.minOrderAmount,
                    discountedPrice,
                };
            }
        }

        return best;
    }

    private resolveCheapestVariant(variants: any[] | null | undefined): { price: number; compareAtPrice: number | null } | null {
        if (!Array.isArray(variants) || variants.length === 0) {
            return null;
        }

        let cheapest: { price: number; compareAtPrice: number | null } | null = null;
        for (const variant of variants) {
            const price = Number(variant?.price);
            if (!Number.isFinite(price) || price <= 0) continue;

            const compareRaw = Number(variant?.compareAtPrice);
            const compareAtPrice = Number.isFinite(compareRaw) && compareRaw > 0 ? compareRaw : null;

            if (!cheapest || price < cheapest.price) {
                cheapest = { price, compareAtPrice };
            }
        }

        return cheapest;
    }

    private async getActiveCouponsForSellers(sellerIds: string[]): Promise<ActiveCouponCandidate[]> {
        if (sellerIds.length === 0) return [];

        const uniqueSellerIds = Array.from(new Set(sellerIds.filter((id) => typeof id === 'string' && id.length > 0)));
        if (uniqueSellerIds.length === 0) return [];

        const now = new Date();
        const coupons = await prisma.coupon.findMany({
            where: {
                isActive: true,
                validFrom: { lte: now },
                validUntil: { gte: now },
                OR: [{ sellerId: null }, { sellerId: { in: uniqueSellerIds } }],
            },
            select: {
                code: true,
                type: true,
                value: true,
                maxDiscountAmount: true,
                minOrderAmount: true,
                sellerId: true,
                usageLimit: true,
                usedCount: true,
            },
            orderBy: [{ validUntil: 'asc' }, { createdAt: 'desc' }],
        });

        return coupons
            .filter((coupon) => coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit)
            .map((coupon) => ({
                code: coupon.code,
                type: coupon.type,
                value: this.toNumber(coupon.value),
                maxDiscountAmount:
                    coupon.maxDiscountAmount === null ? null : this.toNumber(coupon.maxDiscountAmount),
                minOrderAmount: this.toNumber(coupon.minOrderAmount),
                sellerId: coupon.sellerId,
            }))
            .filter((coupon) => coupon.value > 0);
    }

    async listPublic(limit = DEFAULT_LIMIT, audience?: 'MENS' | 'KIDS') {
        const cacheKey = audience ? `${CACHE_KEYS.BESTSELLERS_LIST}:${audience}` : CACHE_KEYS.BESTSELLERS_LIST;
        const cached = await getFromCache<any>(cacheKey);
        if (cached) {
            return cached;
        }

        const items = await bestsellerRepository.listPublic(limit, audience);
        const coupons = await this.getActiveCouponsForSellers(items.map((item) => item.product.sellerId));
        const products = items.map((item) => {
            const cheapestVariant = this.resolveCheapestVariant(item.product.variants ?? []);
            const fallbackSelling = Number(item.product.adminListingPrice ?? item.product.sellerPrice ?? 0);
            const sellingPrice = cheapestVariant?.price ?? fallbackSelling;
            const regularPrice = Math.max(sellingPrice, cheapestVariant?.compareAtPrice ?? 0);
            const activeCoupon = this.getBestCouponPreview(sellingPrice, item.product.sellerId, coupons);
            return {
                id: item.id,
                productId: item.productId,
                position: item.position,
                title: item.product.title,
                image: item.product.images?.[0] ?? null,
                categoryName: item.product.category?.name ?? null,
                compareAtPrice: cheapestVariant?.compareAtPrice ?? null,
                regularPrice,
                sellerPrice: sellingPrice,
                adminPrice: sellingPrice,
                salePrice: sellingPrice,
                minPrice: sellingPrice,
                activeCoupon,
            };
        });

        const response = { products };
        // Bestsellers are curated by admins and invalidated on change.
        await setCache(cacheKey, response, 1800);
        return response;
    }

    async listAdmin() {
        const items = await bestsellerRepository.listAdmin();
        return {
            bestsellers: items.map((item) => ({
                id: item.id,
                productId: item.productId,
                position: item.position,
                title: item.product.title,
                categoryName: item.product.category?.name ?? null,
                sellerEmail: item.product.seller?.email ?? null,
                isPublished: item.product.isPublished,
                deletedByAdmin: item.product.deletedByAdmin,
                image: item.product.images?.[0] ?? null,
            })),
        };
    }

    async add(productId: string, position?: number) {
        const currentCount = await bestsellerRepository.countAll();
        if (currentCount >= DEFAULT_LIMIT) {
            throw ApiError.badRequest('Only 4 products can be marked as bestsellers');
        }

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            throw ApiError.notFound('Product not found');
        }
        if (product.deletedByAdmin) {
            throw ApiError.badRequest('Product deleted by admin');
        }

        const existing = await bestsellerRepository.findByProductId(productId);
        if (existing) {
            throw ApiError.conflict('Product already in bestsellers');
        }

        const finalPosition = position ?? (await bestsellerRepository.getMaxPosition()) + 1;
        const created = await bestsellerRepository.create(productId, finalPosition);
        await invalidateCache(CACHE_KEYS.BESTSELLERS_LIST);
        return created;
    }

    async update(id: string, position: number) {
        const updated = await bestsellerRepository.update(id, position);
        await invalidateCache(CACHE_KEYS.BESTSELLERS_LIST);
        return updated;
    }

    async remove(id: string) {
        await bestsellerRepository.delete(id);
        await invalidateCache(CACHE_KEYS.BESTSELLERS_LIST);
    }

    async removeByProductId(productId: string) {
        await bestsellerRepository.deleteByProductId(productId);
        await invalidateCache(CACHE_KEYS.BESTSELLERS_LIST);
    }
}

export const bestsellerService = new BestsellerService();
