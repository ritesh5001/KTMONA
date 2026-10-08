import { prisma } from '../config/db.js';

/**
 * Invoice Number Generator
 *
 * Format: TV-YYYY-XXXX
 *   YYYY = current year
 *   XXXX = zero-padded sequential number (resets per year)
 *
 * Rules:
 *   - Must be unique (enforced by DB unique constraint)
 *   - Generated only once per order
 *   - Created atomically when order is CONFIRMED (after payment success)
 *   - Never regenerated
 */

/**
 * Generate the next invoice number for the current year.
 *
 * Uses a raw SQL query with FOR UPDATE to lock the row with the highest
 * invoice number, preventing concurrent payment success handlers from
 * generating the same number. The caller MUST run this inside a transaction.
 *
 * Fallback: even if the FOR UPDATE misses (e.g., no existing rows), the
 * @unique constraint on invoiceNumber in the schema catches collisions.
 */
export async function generateInvoiceNumber(
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
    const db = tx ?? prisma;
    const year = new Date().getFullYear();
    const prefix = `TV-${year}-`;

    // Use raw SQL FOR UPDATE to serialize concurrent invoice generation.
    // This locks the row with the highest invoice number for this year,
    // preventing two concurrent transactions from reading the same max.
    const rows = await (db as any).$queryRawUnsafe(
        `SELECT invoice_number FROM orders
         WHERE invoice_number LIKE $1
         ORDER BY invoice_number DESC
         LIMIT 1
         FOR UPDATE`,
        `${prefix}%`,
    ) as Array<{ invoice_number: string | null }>;

    let nextSeq = 1;
    const firstRow = rows[0];
    if (rows.length > 0 && firstRow?.invoice_number) {
        const parts = firstRow.invoice_number.split('-');
        const lastSeq = parseInt(parts[2] ?? '0', 10);
        if (!isNaN(lastSeq)) {
            nextSeq = lastSeq + 1;
        }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}
