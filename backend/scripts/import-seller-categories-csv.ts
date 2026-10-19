/**
 * Imports the KTMONA product taxonomy spreadsheet into the seller tree
 * (SELLER categories, where sellers list products).
 *
 * Columns: Main Category, Sub Category, Child Category, Sub Child Category,
 * Product Type / Leaf. Blank columns are skipped, so a row's path is its
 * non-blank columns in order (2 to 5 levels). "Full Path" is ignored: it is
 * blank on most rows and uses different top-level names on the rest.
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
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import csv from 'csv-parser';
import { prisma } from '../src/config/db.js';
import { invalidateCategoryCache } from '../src/utils/cache.util.js';

const apply = process.argv.includes('--apply');
const csvPath = path.resolve(
    process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '../KTMONA all Products - Sheet1.csv',
);
const LEVELS = ['Main Category', 'Sub Category', 'Child Category', 'Sub Child Category', 'Product Type / Leaf'];
const CHUNK = 1000;

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

interface Node {
    key: string;
    name: string;
    parentKey: string | null;
    depth: number;
    sortOrder: number;
}

async function readTree(file: string): Promise<Node[]> {
    const rows: Record<string, string>[] = [];
    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(file)
            .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^﻿/, '').trim() }))
            .on('data', (row) => rows.push(row))
            .on('end', resolve)
            .on('error', reject);
    });
    const missing = LEVELS.filter((l) => !(l in (rows[0] ?? {})));
    if (missing.length) throw new Error(`CSV is missing columns: ${missing.join(', ')}`);

    // Keyed by full path; siblings keep the order they first appear in.
    const nodes = new Map<string, Node>();
    const childCount = new Map<string | null, number>();
    for (const row of rows) {
        const parts = LEVELS.map((l) => (row[l] ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
        let parentKey: string | null = null;
        parts.forEach((name, i) => {
            const key: string = parentKey === null ? name.toLowerCase() : `${parentKey}\u0000${name.toLowerCase()}`;
            if (!nodes.has(key)) {
                const sortOrder = (childCount.get(parentKey) ?? 0) + 1;
                childCount.set(parentKey, sortOrder);
                nodes.set(key, { key, name, parentKey, depth: i + 1, sortOrder });
            }
            parentKey = key;
        });
    }
    return [...nodes.values()].sort((a, b) => a.depth - b.depth);
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
    console.log(`CSV: ${csvPath}`);
    const nodes = await readTree(csvPath);

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
