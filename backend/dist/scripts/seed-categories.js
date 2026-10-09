/**
 * Creates the KTMONA category tree (main category → group → leaf) from
 * `prisma/data/categories.ts`.
 *
 * Upserts by slug, so it is safe to re-run: names, parents and order are
 * brought back in line with the data file, while images, banners, SEO copy and
 * the active flag set in the admin panel are left alone. Categories that are not
 * in the file are never touched.
 *
 *   npm run seed:categories            # dry run
 *   npm run seed:categories -- --apply
 */
import { prisma } from '../src/config/db.js';
import { invalidateCategoryCache } from '../src/utils/cache.util.js';
import { KTMONA_CATEGORIES } from '../prisma/data/categories.js';
const apply = process.argv.includes('--apply');
function slugify(value) {
    return value
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
/**
 * Flattens the tree into rows, parents before children. A name that repeats
 * (e.g. "Shirts" under both Women Western and Men) gets its main category's
 * slug as a prefix, so the slugs are unique and stable across runs.
 */
function buildRows() {
    const rows = [];
    const used = new Set();
    const claim = (name, mainSlug) => {
        let slug = slugify(name);
        if (used.has(slug))
            slug = `${mainSlug}-${slugify(name)}`;
        if (used.has(slug))
            throw new Error(`Duplicate category slug: ${slug}`);
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
async function main() {
    const rows = buildRows();
    const existing = new Map((await prisma.category.findMany({ where: { slug: { in: rows.map((r) => r.slug) } }, select: { id: true, slug: true } }))
        .map((c) => [c.slug, c.id]));
    const mains = rows.filter((r) => r.parentSlug === null).length;
    const leaves = rows.filter((r) => !rows.some((c) => c.parentSlug === r.slug)).length;
    console.log(`${rows.length} categories in the tree (${mains} main, ${rows.length - mains - leaves} groups, ${leaves} leaves)`);
    console.log(`${existing.size} already exist, ${rows.length - existing.size} to create`);
    if (!apply) {
        console.log('Dry run. Pass --apply to write.');
        return;
    }
    const ids = new Map(existing);
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
            },
            update: { name: row.name, parentId, sortOrder: row.sortOrder },
            select: { id: true },
        });
        ids.set(row.slug, saved.id);
    }
    await invalidateCategoryCache().catch(() => undefined);
    console.log(`Done. ${rows.length} categories saved.`);
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
//# sourceMappingURL=seed-categories.js.map