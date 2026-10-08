import { OccasionRepository, occasionRepository, type OccasionEntity } from '../repositories/occasion.repository.js';
import {
    getFromCache,
    setCache,
    invalidateCache,
    CACHE_KEYS,
} from '../utils/cache.util.js';
import { ApiError } from '../errors/ApiError.js';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, occasionTag } from '../live/cache-tags.js';

/**
 * Occasion Service
 * Business logic for occasion management
 */
export class OccasionService {
    constructor(private readonly repository: OccasionRepository) {}

    private slugify(value: string): string {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    private async getUniqueSlug(base: string, excludeId?: string) {
        let slug = base;
        let counter = 1;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const existing = await this.repository.findBySlug(slug);
            if (!existing || (excludeId && existing.id === excludeId)) {
                return slug;
            }
            counter += 1;
            slug = `${base}-${counter}`;
        }
    }

    /**
     * List all active occasions (public)
     */
    async listOccasions(): Promise<{ occasions: OccasionEntity[] }> {
        const cached = await getFromCache<{ occasions: OccasionEntity[] }>(CACHE_KEYS.OCCASIONS_LIST);
        if (cached) return cached;

        const occasions = await this.repository.findAllActive();
        const response = { occasions };
        await setCache(CACHE_KEYS.OCCASIONS_LIST, response, 120);
        return response;
    }

    /**
     * List all occasions for admin (active + inactive)
     */
    async listAllOccasions(): Promise<{ occasions: OccasionEntity[] }> {
        const occasions = await this.repository.findAll();
        return { occasions };
    }

    /**
     * Create occasion (admin)
     */
    async createOccasion(input: { name: string; image?: string | undefined }) {
        const baseSlug = this.slugify(input.name);
        if (!baseSlug) {
            throw ApiError.badRequest('Invalid occasion name');
        }

        const slug = await this.getUniqueSlug(baseSlug);
        const created = await this.repository.create({ ...input, slug });

        await invalidateCache(CACHE_KEYS.OCCASIONS_LIST);
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [CACHE_TAGS.occasions, CACHE_TAGS.products, CACHE_TAGS.search, occasionTag(slug)],
            audience: { allAuthenticated: true },
        });
        return created;
    }

    /**
     * Update occasion (admin)
     */
    async updateOccasion(id: string, data: {
        name?: string | undefined;
        image?: string | null | undefined;
        isActive?: boolean | undefined;
    }) {
        const occasion = await this.repository.findById(id);
        if (!occasion) {
            throw ApiError.notFound('Occasion not found');
        }

        let slug: string | undefined;
        if (data.name) {
            const baseSlug = this.slugify(data.name);
            if (!baseSlug) {
                throw ApiError.badRequest('Invalid occasion name');
            }
            slug = await this.getUniqueSlug(baseSlug, id);
        }

        const updated = await this.repository.update(id, {
            ...data,
            ...(slug ? { slug } : {}),
        });

        await invalidateCache(CACHE_KEYS.OCCASIONS_LIST);
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [
                CACHE_TAGS.occasions,
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                occasionTag(updated.slug),
                ...(occasion.slug ? [occasionTag(occasion.slug)] : []),
            ],
            audience: { allAuthenticated: true },
        });
        return updated;
    }

    /**
     * Delete occasion (admin) — fails if products are linked
     */
    async deleteOccasion(id: string) {
        const occasion = await this.repository.findById(id);
        if (!occasion) {
            throw ApiError.notFound('Occasion not found');
        }

        const hasProducts = await this.repository.hasProducts(id);
        if (hasProducts) {
            throw ApiError.badRequest('Cannot delete occasion with linked products. Remove product associations first.');
        }

        await this.repository.delete(id);
        await invalidateCache(CACHE_KEYS.OCCASIONS_LIST);
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [
                CACHE_TAGS.occasions,
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                occasionTag(occasion.slug),
            ],
            audience: { allAuthenticated: true },
        });
    }

    /**
     * Toggle occasion active state (admin)
     */
    async toggleOccasion(id: string) {
        const occasion = await this.repository.findById(id);
        if (!occasion) {
            throw ApiError.notFound('Occasion not found');
        }

        const updated = await this.repository.update(id, {
            isActive: !occasion.isActive,
        });

        await invalidateCache(CACHE_KEYS.OCCASIONS_LIST);
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [CACHE_TAGS.occasions, CACHE_TAGS.products, CACHE_TAGS.search, occasionTag(updated.slug)],
            audience: { allAuthenticated: true },
        });
        return updated;
    }

    /**
     * Validate that all occasion IDs exist and are active.
     * Uses batch query instead of N+1 individual lookups.
     */
    async validateOccasionIds(ids: string[]): Promise<void> {
        if (ids.length === 0) return;

        const occasions = await this.repository.findActiveByIds(ids);
        if (occasions.length !== ids.length) {
            const foundIds = new Set(occasions.map((o: OccasionEntity) => o.id));
            const missing = ids.filter(id => !foundIds.has(id));
            throw ApiError.badRequest(`Invalid occasion selection: ${missing.join(', ')}`);
        }
    }

    /**
     * Sync occasions for a product.
     */
    async syncProductOccasions(productId: string, occasionIds: string[]): Promise<void> {
        if (occasionIds.length > 0) {
            await this.validateOccasionIds(occasionIds);
        }
        await this.repository.syncProductOccasions(productId, occasionIds);
    }

    /**
     * Get occasion IDs for a product.
     */
    async getProductOccasionIds(productId: string): Promise<string[]> {
        return this.repository.getProductOccasionIds(productId);
    }
}

export const occasionService = new OccasionService(occasionRepository);
