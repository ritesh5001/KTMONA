/**
 * Admin-defined "Product Details" fields for the seller catalog form.
 *
 * Fields are set on any category; a category without its own fields uses the
 * nearest ancestor's. When nothing is configured on the whole path, the seller
 * form falls back to its built-in defaults (`fields: null`).
 */

import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';

const field = z
    .object({
        key: z.string().trim().min(1).max(60).optional(),
        label: z.string().trim().min(1, 'Every field needs a name').max(60),
        type: z.enum(['SELECT', 'TEXT', 'NUMBER']).default('SELECT'),
        options: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
        required: z.boolean().default(false),
        placeholder: z.string().trim().max(120).nullable().optional(),
    })
    .refine((f) => f.type !== 'SELECT' || f.options.length > 0, { message: 'Drop-down fields need at least one option' });

export const categoryFieldsSchema = z.object({
    fields: z.array(field).max(40),
});

export interface CategoryField {
    key: string;
    label: string;
    type: 'SELECT' | 'TEXT' | 'NUMBER';
    options: string[];
    required: boolean;
    placeholder: string | null;
}

async function ancestry(categoryId: string): Promise<{ id: string; name: string }[]> {
    const path: { id: string; name: string }[] = [];
    let id: string | null = categoryId;
    for (let guard = 0; id && guard < 10; guard += 1) {
        const row: { id: string; name: string; parentId: string | null } | null = await prisma.category.findUnique({ where: { id }, select: { id: true, name: true, parentId: true } });
        if (!row) break;
        path.push({ id: row.id, name: row.name });
        id = row.parentId;
    }
    return path; // leaf first
}

const toField = (r: { key: string; label: string; type: string; options: string[]; required: boolean; placeholder: string | null }): CategoryField => ({
    key: r.key,
    label: r.label,
    type: r.type as CategoryField['type'],
    options: r.options,
    required: r.required,
    placeholder: r.placeholder,
});

class CategoryAttributeService {
    /** The fields a seller fills for products in this category. */
    async resolve(categoryId: string) {
        const path = await ancestry(categoryId);
        if (!path.length) throw ApiError.notFound('Category not found');
        const rows = await prisma.categoryAttribute.findMany({
            where: { categoryId: { in: path.map((p) => p.id) } },
            orderBy: { sortOrder: 'asc' },
        });
        for (const cat of path) {
            const own = rows.filter((r) => r.categoryId === cat.id);
            if (own.length) return { fields: own.map(toField), source: cat };
        }
        return { fields: null as CategoryField[] | null, source: null };
    }

    /** Admin view: this category's own fields, and what it inherits otherwise. */
    async adminGet(categoryId: string) {
        const own = await prisma.categoryAttribute.findMany({ where: { categoryId }, orderBy: { sortOrder: 'asc' } });
        const effective = await this.resolve(categoryId);
        return {
            own: own.map(toField),
            inherited: own.length ? null : effective.fields ? { fields: effective.fields, from: effective.source } : null,
        };
    }

    /** Replace a category's fields (an empty list = inherit from the parent again). */
    async save(categoryId: string, input: z.infer<typeof categoryFieldsSchema>) {
        const cat = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
        if (!cat) throw ApiError.notFound('Category not found');
        const seen = new Set<string>();
        const rows = input.fields.map((f, i) => {
            const key = (f.key || f.label).trim();
            const k = key.toLowerCase();
            if (seen.has(k)) throw ApiError.badRequest(`"${f.label}" appears twice`);
            seen.add(k);
            return {
                categoryId,
                key,
                label: f.label,
                type: f.type,
                options: f.type === 'SELECT' ? [...new Set(f.options)] : [],
                required: f.required,
                placeholder: f.placeholder ?? null,
                sortOrder: i,
            };
        });
        await prisma.$transaction([
            prisma.categoryAttribute.deleteMany({ where: { categoryId } }),
            ...(rows.length ? [prisma.categoryAttribute.createMany({ data: rows })] : []),
        ]);
        return this.adminGet(categoryId);
    }
}

export const categoryAttributeService = new CategoryAttributeService();
