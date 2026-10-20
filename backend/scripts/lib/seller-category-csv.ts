/**
 * Reads the KTMONA category spreadsheet into a flat list of tree nodes.
 * Shared by import-seller-categories-csv.ts (adds what is missing) and
 * replace-seller-categories-csv.ts (swaps the whole seller tree).
 *
 * Columns: Main Category, Sub Category, Child Category, Sub Child Category,
 * Product Type / Leaf. Blank columns are skipped, so a row's path is its
 * non-blank columns in order. "Full Path" is ignored; it is only a readable
 * copy of the columns.
 */
import fs from 'node:fs';
import csv from 'csv-parser';

export const LEVELS = ['Main Category', 'Sub Category', 'Child Category', 'Sub Child Category', 'Product Type / Leaf'];

export const DEFAULT_CSV = '../KTMONA all Products - Sheet1.csv';

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export interface CsvNode {
    /** Lower-cased path joined with \u0000; unique per node. */
    key: string;
    name: string;
    parentKey: string | null;
    depth: number;
    sortOrder: number;
}

/** Lower-cased lookup key for a path of names, matching CsvNode.key. */
export function pathKey(names: string[]): string {
    return names.map((n) => n.trim().toLowerCase()).join('\u0000');
}

/** Nodes sorted parents-first; siblings keep the order they first appear in. */
export async function readCategoryCsv(file: string): Promise<CsvNode[]> {
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

    const nodes = new Map<string, CsvNode>();
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

export function dbHost(): string {
    try {
        return new URL(process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || '').hostname;
    } catch {
        return 'unknown';
    }
}
