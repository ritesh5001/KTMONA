/**
 * Links between the customer menu (STOREFRONT categories) and the seller
 * listing tree (SELLER categories). A customer category shows the products of
 * the seller categories linked to it and everything below them.
 *
 * Auto-link matches categories by name ("T-Shirts" ↔ "Tshirts", "Sarees" ↔
 * "Saree") while keeping men's, women's and kids' categories apart, so it can
 * be re-run whenever sellers' categories grow; it only ever adds links.
 */

import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { invalidateCategoryCache, invalidateProductCaches } from '../utils/cache.util.js';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS } from '../live/cache-tags.js';

export const categoryLinksSchema = z.object({ sellerCategoryIds: z.array(z.string().min(1)).max(200) });

type Cat = { id: string; name: string; parentId: string | null; scope: 'SELLER' | 'STOREFRONT'; isActive: boolean };

const GENDER_WORDS: Record<string, 'men' | 'women' | 'kids'> = {
    men: 'men', mens: 'men', man: 'men', gents: 'men', male: 'men',
    women: 'women', womens: 'women', woman: 'women', ladies: 'women', female: 'women',
    kids: 'kids', kid: 'kids', baby: 'kids', babies: 'kids', boys: 'kids', boy: 'kids', girls: 'kids', girl: 'kids', children: 'kids', infant: 'kids', infants: 'kids',
};

/** Words that only tell the gender of a tree ("Kurti & Saree" is women's); kept in name keys. */
const GENDER_HINTS: Record<string, 'men' | 'women' | 'kids'> = {
    kurti: 'women', kurtis: 'women', saree: 'women', sarees: 'women', lehenga: 'women', lehengas: 'women',
    lingerie: 'women', bra: 'women', bras: 'women', maternity: 'women', dupatta: 'women', dupattas: 'women',
    toys: 'kids', toy: 'kids',
};

function words(name: string): string[] {
    return name
        .toLowerCase()
        .replace(/&/g, ' ')
        .replace(/'s\b/g, 's')
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

function singular(word: string): string {
    if (word.length > 4 && /(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
}

/** Name without gender words, singular, no spaces: "Men's T-Shirts" → "tshirt". */
export function nameKey(name: string): string {
    return words(name)
        .filter((w) => !GENDER_WORDS[w] && w !== 'and' && w !== 'for')
        .map(singular)
        .join('');
}

/** men / women / kids from the category and its ancestors (nearest wins). */
function genderOf(id: string, byId: Map<string, Cat>): 'men' | 'women' | 'kids' | null {
    let cur = byId.get(id);
    for (let guard = 0; cur && guard < 10; guard++) {
        for (const w of words(cur.name)) {
            const g = GENDER_WORDS[w] ?? GENDER_HINTS[w];
            if (g) return g;
        }
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return null;
}

function pathLabel(id: string, byId: Map<string, Cat>): string {
    const out: string[] = [];
    let cur = byId.get(id);
    for (let guard = 0; cur && guard < 10; guard++) {
        out.unshift(cur.name);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out.join(' › ');
}

async function loadAll() {
    const all = (await prisma.category.findMany({ select: { id: true, name: true, parentId: true, scope: true, isActive: true } })) as Cat[];
    return { all, byId: new Map(all.map((c) => [c.id, c])) };
}

async function refresh() {
    await invalidateCategoryCache();
    await invalidateProductCaches();
    await dispatchFreshness({
        type: 'catalog.updated',
        tags: [CACHE_TAGS.categories, CACHE_TAGS.products, CACHE_TAGS.search],
        audience: { allAuthenticated: true },
    }).catch(() => undefined);
}

class CategoryLinksService {
    async get(storefrontId: string) {
        const { byId } = await loadAll();
        const cat = byId.get(storefrontId);
        if (!cat) throw ApiError.notFound('Category not found');
        if (cat.scope !== 'STOREFRONT') throw ApiError.badRequest('Only customer-menu categories have links');
        const links = await prisma.categoryLink.findMany({ where: { storefrontId }, select: { sellerCategoryId: true } });
        return {
            links: links
                .map((l) => byId.get(l.sellerCategoryId))
                .filter((c): c is Cat => !!c)
                .map((c) => ({ id: c.id, name: c.name, path: pathLabel(c.id, byId) }))
                .sort((a, b) => a.path.localeCompare(b.path)),
        };
    }

    async set(storefrontId: string, sellerCategoryIds: string[]) {
        const { byId } = await loadAll();
        const cat = byId.get(storefrontId);
        if (!cat || cat.scope !== 'STOREFRONT') throw ApiError.badRequest('Pick a customer-menu category');
        const ids = [...new Set(sellerCategoryIds)];
        const bad = ids.find((id) => byId.get(id)?.scope !== 'SELLER');
        if (bad) throw ApiError.badRequest('Links must point to seller categories');
        await prisma.$transaction([
            prisma.categoryLink.deleteMany({ where: { storefrontId } }),
            prisma.categoryLink.createMany({ data: ids.map((sellerCategoryId) => ({ storefrontId, sellerCategoryId })), skipDuplicates: true }),
        ]);
        await refresh();
        return this.get(storefrontId);
    }

    /**
     * Link every customer-menu category to the seller categories with the
     * same name (and compatible men/women/kids). Adds links, never removes.
     */
    async autoLink(options: { apply: boolean } = { apply: true }) {
        const { all, byId } = await loadAll();
        const sellers = all.filter((c) => c.scope === 'SELLER' && c.isActive);
        const storefront = all.filter((c) => c.scope === 'STOREFRONT');
        const existing = new Set((await prisma.categoryLink.findMany({ select: { storefrontId: true, sellerCategoryId: true } })).map((l) => `${l.storefrontId}:${l.sellerCategoryId}`));

        const sellersByKey = new Map<string, Cat[]>();
        for (const c of sellers) {
            const key = nameKey(c.name);
            if (!key) continue;
            if (!sellersByKey.has(key)) sellersByKey.set(key, []);
            sellersByKey.get(key)!.push(c);
        }

        const planned: { storefrontId: string; sellerCategoryId: string; storefront: string; seller: string }[] = [];
        for (const s of storefront) {
            const key = nameKey(s.name);
            if (!key) continue;
            const sg = genderOf(s.id, byId);
            for (const c of sellersByKey.get(key) ?? []) {
                const cg = genderOf(c.id, byId);
                if (sg && cg && sg !== cg) continue;
                if (existing.has(`${s.id}:${c.id}`)) continue;
                planned.push({ storefrontId: s.id, sellerCategoryId: c.id, storefront: pathLabel(s.id, byId), seller: pathLabel(c.id, byId) });
            }
        }

        if (options.apply && planned.length) {
            await prisma.categoryLink.createMany({
                data: planned.map(({ storefrontId, sellerCategoryId }) => ({ storefrontId, sellerCategoryId })),
                skipDuplicates: true,
            });
            await refresh();
        }
        return { created: options.apply ? planned.length : 0, planned };
    }
}

export const categoryLinksService = new CategoryLinksService();
