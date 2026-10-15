/**
 * Creates the customer menu (STOREFRONT categories: main category → group →
 * leaf, Meesho-style) from `prisma/data/categories.ts`, then links each menu
 * item to the seller categories with the same name so it shows their products.
 *
 * The seller tree (SELLER categories, where products are listed) is never
 * restructured. If a seller category already uses a slug the menu needs (e.g.
 * "kids-toys"), the seller category's slug gets a "-seller" suffix so the menu
 * keeps the clean customer URL; its name, place and products are unchanged.
 *
 * Upserts by slug, so it is safe to re-run: names, parents and order follow
 * the data file, while images, banners, SEO copy and the active flag set in
 * the admin panel are left alone. Links are only ever added.
 *
 *   npm run seed:categories            # dry run
 *   npm run seed:categories -- --apply
 */
import { prisma } from '../src/config/db.js';
import { invalidateCategoryCache } from '../src/utils/cache.util.js';
import { categoryLinksService } from '../src/services/category-links.service.js';
import { KTMONA_CATEGORIES } from '../prisma/data/categories.js';

const apply = process.argv.includes('--apply');

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

interface Row {
    name: string;
    slug: string;
    parentSlug: string | null;
    sortOrder: number;
    description: string | null;
}

/**
 * Flattens the tree into rows, parents before children. A name that repeats
 * (e.g. "Shirts" under both Women Western and Men) gets its main category's
 * slug as a prefix, so the slugs are unique and stable across runs.
 */
function buildRows(): Row[] {
    const rows: Row[] = [];
    const used = new Set<string>();
    const claim = (name: string, mainSlug: string) => {
        let slug = slugify(name);
        if (used.has(slug)) slug = `${mainSlug}-${slugify(name)}`;
        if (used.has(slug)) throw new Error(`Duplicate category slug: ${slug}`);
        used.add(slug);
        return slug;
    };

    KTMONA_CATEGORIES.forEach((main, mi) => {
        used.add(main.slug);
        rows.push({ name: main.name, slug: main.slug, parentSlug: null, sortOrder: mi + 1, description: main.description });
    });
    KTMONA_CATEGORIES.forEach((main) => {
        main.groups.forEach((group, gi) => {
            const groupSlug = claim(group.name, main.slug);
            rows.push({ name: group.name, slug: groupSlug, parentSlug: main.slug, sortOrder: gi + 1, description: null });
            group.items.forEach((item, ii) => {
                rows.push({ name: item, slug: claim(item, main.slug), parentSlug: groupSlug, sortOrder: ii + 1, description: null });
            });
        });
    });
    return rows;
}

function dbHost(): string {
    try {
        return new URL(process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || '').hostname;
    } catch {
        return 'unknown';
    }
}

async function main() {
    console.log(`Database: ${dbHost()}`);
    const rows = buildRows();
    const existing = new Map(
        (await prisma.category.findMany({ where: { slug: { in: rows.map((r) => r.slug) } }, select: { id: true, slug: true, scope: true, name: true } }))
            .map((c) => [c.slug, c]),
    );
    const clashes = [...existing.values()].filter((c) => c.scope === 'SELLER');
    const mine = [...existing.values()].filter((c) => c.scope === 'STOREFRONT');
    const mains = rows.filter((r) => r.parentSlug === null).length;
    const leaves = rows.filter((r) => !rows.some((c) => c.parentSlug === r.slug)).length;
    console.log(`Customer menu: ${rows.length} categories (${mains} main, ${rows.length - mains - leaves} groups, ${leaves} leaves)`);
    console.log(`${mine.length} already exist, ${rows.length - mine.length} to create`);
    if (clashes.length) {
        console.log(`${clashes.length} seller categories use a slug the menu needs; their slug gets "-seller":`);
        for (const c of clashes) console.log(`  ${c.name}  (${c.slug} → ${c.slug}-seller)`);
    }

    if (!apply) {
        console.log('Dry run. Pass --apply to write. Links to seller categories are made after the menu exists.');
        return;
    }

    for (const c of clashes) {
        let slug = `${c.slug}-seller`;
        for (let n = 2; await prisma.category.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${c.slug}-seller-${n}`;
        await prisma.category.update({ where: { id: c.id }, data: { slug } });
    }

    const ids = new Map(mine.map((c) => [c.slug, c.id]));
    for (const row of rows) {
        const parentId = row.parentSlug ? ids.get(row.parentSlug) ?? null : null;
        const saved = await prisma.category.upsert({
            where: { slug: row.slug },
            create: {
                name: row.name,
                slug: row.slug,
                parentId,
                sortOrder: row.sortOrder,
                description: row.description,
                isActive: true,
                scope: 'STOREFRONT',
            },
            update: { name: row.name, parentId, sortOrder: row.sortOrder, scope: 'STOREFRONT' },
            select: { id: true },
        });
        ids.set(row.slug, saved.id);
    }
    console.log(`Customer menu saved (${rows.length} categories).`);

    const { created, planned } = await categoryLinksService.autoLink({ apply: true });
    console.log(`Linked ${created} menu categories to seller categories:`);
    for (const p of planned) console.log(`  ${p.storefront}  ←  ${p.seller}`);

    await invalidateCategoryCache().catch(() => undefined);
    console.log('Done.');
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        process.exit();
    });
