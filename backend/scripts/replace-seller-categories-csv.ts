/**
 * Replaces the whole seller category tree (SELLER scope) with the spreadsheet.
 *
 * Unlike import-seller-categories-csv.ts, which only adds what is missing,
 * this builds the spreadsheet tree from scratch and deletes every existing
 * seller category. Whatever points at an old category — products, catalog
 * form attributes, catalog uploads — is moved to its new category through
 * MOVES below; the run refuses to start if anything points at an old
 * category that MOVES does not cover.
 *
 * Before writing, the old tree, its attributes and the moved rows are saved
 * as JSON under backups/. Everything else happens in one transaction.
 *
 *   npm run replace:seller-categories                      # dry run
 *   npm run replace:seller-categories -- --apply
 *   npm run replace:seller-categories -- path/to/file.csv --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/config/db.js';
import { invalidateCategoryCache } from '../src/utils/cache.util.js';
import { DEFAULT_CSV, dbHost, pathKey, readCategoryCsv, slugify } from './lib/seller-category-csv.js';

const apply = process.argv.includes('--apply');
const csvPath = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? DEFAULT_CSV);
const CHUNK = 1000;

/**
 * Old category path -> new category path. Products and catalog uploads move
 * to `to`; the category's attributes move to `attributesTo` (default `to`),
 * so a parent can hold fields its leaves inherit.
 */
const MOVES: { from: string[]; to: string[]; attributesTo?: string[] }[] = [
    {
        from: ['Women Fashion', 'Accessories', 'Jewellery', 'Bracelet & Bangles'],
        to: ["Women's Fashion", 'Jewellery', 'Bracelets & Bangles', 'Bangles'],
        attributesTo: ["Women's Fashion", 'Jewellery', 'Bracelets & Bangles'],
    },
    {
        from: ['Home & Kitchen', 'Cleaning Tools', 'Sweepers', 'Brooms'],
        to: ['Home & Kitchen', 'Cleaning & Household Supplies', 'Cleaning Tools', 'Floor Cleaning', 'Broom'],
    },
    {
        from: ['Home & Kitchen', 'Cleaning Tools', 'Mops & Accessories', 'Mops Sticks'],
        to: ['Home & Kitchen', 'Cleaning & Household Supplies', 'Cleaning Tools', 'Mops'],
    },
    {
        from: ['Home & Kitchen', 'Home Cleaning & Improvement', 'Cleaning Supplies', 'Cleaning Sets'],
        to: ['Home & Kitchen', 'Cleaning & Household Supplies', 'Cleaning Tools', 'Cleaning Sets'],
    },
];

async function main() {
    console.log(`Database: ${dbHost()}`);
    console.log(`CSV: ${csvPath}`);
    const nodes = await readCategoryCsv(csvPath);

    const existing = await prisma.category.findMany({
        select: { id: true, name: true, slug: true, parentId: true, scope: true },
    });
    const byId = new Map(existing.map((c) => [c.id, c]));
    const oldPath = (id: string): string[] => {
        const names: string[] = [];
        for (let c = byId.get(id); c; c = c.parentId ? byId.get(c.parentId) : undefined) names.unshift(c.name);
        return names;
    };
    const oldIds = existing.filter((c) => c.scope === 'SELLER').map((c) => c.id);
    const oldIdSet = new Set(oldIds);

    // New tree: fresh ids, parents first. Slugs only have to avoid the
    // categories that stay (other scopes); old seller slugs are retired first.
    const usedSlugs = new Set(existing.filter((c) => !oldIdSet.has(c.id)).map((c) => c.slug));
    const ids = new Map<string, string>();
    const slugs = new Map<string, string>();
    const toCreate = nodes.map((node) => {
        const base = slugify(node.name) || 'category';
        let slug = base;
        if (usedSlugs.has(slug) && node.parentKey) slug = `${slugs.get(node.parentKey)}-${base}`;
        for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
        usedSlugs.add(slug);
        const id = randomUUID().replace(/-/g, '');
        ids.set(node.key, id);
        slugs.set(node.key, slug);
        return {
            id,
            name: node.name,
            slug,
            parentId: node.parentKey ? ids.get(node.parentKey)! : null,
            sortOrder: node.sortOrder,
            depth: node.depth,
        };
    });

    // Resolve MOVES against both trees.
    const oldByPath = new Map(oldIds.map((id) => [pathKey(oldPath(id)), id]));
    const problems: string[] = [];
    const moves = MOVES.map((m) => {
        const fromId = oldByPath.get(pathKey(m.from));
        const toId = ids.get(pathKey(m.to));
        const attrId = ids.get(pathKey(m.attributesTo ?? m.to));
        if (!fromId) problems.push(`MOVES: old category not found: ${m.from.join(' > ')}`);
        if (!toId || !attrId) problems.push(`MOVES: new category not in CSV: ${(toId ? m.attributesTo! : m.to).join(' > ')}`);
        return { ...m, fromId: fromId!, toId: toId!, attrId: attrId! };
    });
    const moved = new Set(moves.map((m) => m.fromId));

    // Everything that references an old seller category must be covered.
    const [products, attributes, uploads, links, rules, campaigns, requests] = await Promise.all([
        prisma.product.findMany({ where: { categoryId: { in: oldIds } }, select: { id: true, categoryId: true } }),
        prisma.categoryAttribute.findMany({ where: { categoryId: { in: oldIds } } }),
        prisma.catalogUpload.findMany({ where: { categoryId: { in: oldIds } }, select: { id: true, categoryId: true } }),
        prisma.categoryLink.count({ where: { sellerCategoryId: { in: oldIds } } }),
        prisma.commissionRule.count({ where: { categoryId: { in: oldIds } } }),
        prisma.platformCampaign.count({ where: { categoryIds: { hasSome: oldIds } } }),
        prisma.categoryRequest.count({ where: { status: 'PENDING' } }),
    ]);
    const unmapped = new Set(
        [...products, ...attributes, ...uploads].map((r) => r.categoryId).filter((id) => !moved.has(id)),
    );
    for (const id of unmapped) problems.push(`Not in MOVES but still referenced: ${oldPath(id).join(' > ')}`);
    if (links) problems.push(`${links} storefront link(s) point at old seller categories`);
    if (rules) problems.push(`${rules} commission rule(s) point at old seller categories`);
    if (campaigns) problems.push(`${campaigns} platform campaign(s) are limited to old seller categories`);
    if (requests) problems.push(`${requests} pending category request(s) point at the old tree`);

    const perLevel = [1, 2, 3, 4, 5].map((d) => toCreate.filter((c) => c.depth === d).length).join(' / ');
    console.log(`Old seller tree: ${oldIds.length} categories (deleted)`);
    console.log(`New seller tree: ${toCreate.length} categories by level: ${perLevel}`);
    console.log(`Top level: ${toCreate.filter((c) => c.depth === 1).map((c) => c.name).join(' | ')}`);
    for (const m of moves) {
        const n = (rows: { categoryId: string }[]) => rows.filter((r) => r.categoryId === m.fromId).length;
        console.log(
            `  ${m.from.join(' > ')}\n    -> ${m.to.join(' > ')}: ${n(products)} product(s), ${n(uploads)} catalog upload(s)` +
                `\n    -> ${(m.attributesTo ?? m.to).join(' > ')}: ${n(attributes)} attribute(s)`,
        );
    }
    if (problems.length) {
        console.error(`\nCannot replace the tree:\n  ${problems.join('\n  ')}`);
        process.exitCode = 1;
        return;
    }
    if (!apply) {
        console.log('\nDry run. Pass --apply to write.');
        return;
    }

    const backupDir = path.resolve('backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `seller-categories-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    const oldRows = await prisma.category.findMany({ where: { id: { in: oldIds } } });
    fs.writeFileSync(backupFile, JSON.stringify({ database: dbHost(), categories: oldRows, attributes, products, uploads }));
    console.log(`\nBackup: ${backupFile}`);

    await prisma.$transaction(
        async (tx) => {
            await tx.$executeRaw`UPDATE categories SET slug = 'retired-' || id WHERE id = ANY(${oldIds}::text[])`;
            for (let depth = 1; depth <= 5; depth++) {
                const level = toCreate.filter((c) => c.depth === depth);
                for (let i = 0; i < level.length; i += CHUNK) {
                    await tx.category.createMany({
                        data: level.slice(i, i + CHUNK).map(({ depth: _d, ...c }) => ({ ...c, isActive: true, scope: 'SELLER' as const })),
                    });
                }
                console.log(`  created level ${depth}: ${level.length}`);
            }
            for (const m of moves) {
                await tx.product.updateMany({ where: { categoryId: m.fromId }, data: { categoryId: m.toId } });
                await tx.catalogUpload.updateMany({ where: { categoryId: m.fromId }, data: { categoryId: m.toId } });
                await tx.categoryAttribute.updateMany({ where: { categoryId: m.fromId }, data: { categoryId: m.attrId } });
            }
            const left = await tx.product.count({ where: { categoryId: { in: oldIds } } });
            if (left) throw new Error(`${left} product(s) still on old categories; rolled back`);
            const deleted = await tx.$executeRaw`DELETE FROM categories WHERE id = ANY(${oldIds}::text[])`;
            console.log(`  deleted old categories: ${deleted}`);
        },
        { maxWait: 30_000, timeout: 20 * 60_000 },
    );

    const total = await prisma.category.count({ where: { scope: 'SELLER' } });
    console.log(`Seller categories now: ${total}`);
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
