/**
 * Imports the KTMONA product taxonomy spreadsheet into the seller tree
 * (SELLER categories, where sellers list products).
 *
 * Columns: Main Category, Sub Category, Child Category, Sub Child Category,
 * Product Type / Leaf. Blank columns are skipped, so a row's path is its
 * non-blank columns in order (3 to 5 levels). "Full Path" is ignored; it is
 * only a readable copy of the columns.
 *
 * A category is matched to an existing seller category by name (ignoring
 * case) under the same parent, so the existing tree is reused and re-running
 * only creates what is missing. Existing categories are never renamed, moved,
 * reordered or deleted.
 *
 *   npm run import:seller-categories                       # dry run
 *   npm run import:seller-categories -- --apply
 *   npm run import:seller-categories -- path/to/file.csv --apply
 */
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/config/db.js';
import { invalidateCategoryCache } from '../src/utils/cache.util.js';
import { DEFAULT_CSV, LEVELS, dbHost, readCategoryCsv, slugify } from './lib/seller-category-csv.js';

const apply = process.argv.includes('--apply');
const csvPath = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? DEFAULT_CSV);
const CHUNK = 1000;

async function main() {
    console.log(`Database: ${dbHost()}`);
    console.log(`CSV: ${csvPath}`);
    const nodes = await readCategoryCsv(csvPath);

    const existing = await prisma.category.findMany({
        select: { id: true, name: true, slug: true, parentId: true, scope: true },
    });
    const usedSlugs = new Set(existing.map((c) => c.slug));
    const byParentAndName = new Map(
        existing
            .filter((c) => c.scope === 'SELLER')
            .map((c) => [`${c.parentId ?? ''}|${c.name.trim().toLowerCase()}`, c]),
    );

    // Resolve parents before children: ids for matched nodes come from the
    // database, ids for new ones are assigned here so children can point at them.
    const ids = new Map<string, string>();
    const slugs = new Map<string, string>();
    const toCreate: { id: string; name: string; slug: string; parentId: string | null; sortOrder: number; depth: number }[] = [];
    let matched = 0;

    for (const node of nodes) {
        const parentId = node.parentKey ? ids.get(node.parentKey)! : null;
        const found = byParentAndName.get(`${parentId ?? ''}|${node.name.toLowerCase()}`);
        if (found) {
            ids.set(node.key, found.id);
            slugs.set(node.key, found.slug);
            matched++;
            continue;
        }
        const base = slugify(node.name) || 'category';
        let slug = base;
        if (usedSlugs.has(slug) && node.parentKey) slug = `${slugs.get(node.parentKey)}-${base}`;
        for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
        usedSlugs.add(slug);

        const id = randomUUID().replace(/-/g, '');
        ids.set(node.key, id);
        slugs.set(node.key, slug);
        toCreate.push({ id, name: node.name, slug, parentId, sortOrder: node.sortOrder, depth: node.depth });
    }

    const perLevel = (list: { depth: number }[]) =>
        LEVELS.map((_, i) => list.filter((n) => n.depth === i + 1).length).join(' / ');
    console.log(`Spreadsheet: ${nodes.length} categories by level (${LEVELS.length} levels): ${perLevel(nodes)}`);
    console.log(`Already in the seller tree: ${matched}`);
    console.log(`To create: ${toCreate.length} (${perLevel(toCreate)})`);
    for (const c of toCreate.slice(0, 15)) console.log(`  + ${c.name}  (${c.slug})`);
    if (toCreate.length > 15) console.log(`  … and ${toCreate.length - 15} more`);

    if (!apply) {
        console.log('Dry run. Pass --apply to write.');
        return;
    }

    // createMany per level, in chunks, so parents always exist first. Each
    // chunk is all-or-nothing; a re-run picks up where a failed run stopped.
    let done = 0;
    for (let depth = 1; depth <= LEVELS.length; depth++) {
        const level = toCreate.filter((c) => c.depth === depth);
        for (let i = 0; i < level.length; i += CHUNK) {
            await prisma.category.createMany({
                data: level.slice(i, i + CHUNK).map(({ depth: _d, ...c }) => ({ ...c, isActive: true, scope: 'SELLER' as const })),
            });
            done += Math.min(CHUNK, level.length - i);
            console.log(`  created ${done}/${toCreate.length}`);
        }
    }

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
