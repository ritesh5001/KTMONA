/**
 * India GST Calculation Engine
 *
 * Handles CGST / SGST (intra-state) and IGST (inter-state) split logic.
 * All amounts are rounded to 2 decimal places.
 *
 * Rules:
 *   - If buyer state is unknown or same as seller state → intra-state → CGST + SGST (50/50)
 *   - If buyer state differs from seller state → inter-state → IGST (100%)
 *   - Zero tax rate → all GST fields are zero
 */
export interface GSTInput {
    price: number;
    quantity: number;
    taxRate: number;
    sellerState: string;
    buyerState: string;
}
export interface GSTResult {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalAmount: number;
}
/**
 * Calculate GST breakdown for a single line item.
 *
 * @param input - Price, quantity, taxRate (percentage), and seller/buyer states
 * @returns GST breakdown with taxable amount, CGST, SGST, IGST, and total
 */
export declare function calculateGST(input: GSTInput): GSTResult;
//# sourceMappingURL=gst.util.d.ts.map