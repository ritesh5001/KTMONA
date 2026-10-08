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
export declare function generateInvoiceNumber(tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string>;
//# sourceMappingURL=invoice.util.d.ts.map