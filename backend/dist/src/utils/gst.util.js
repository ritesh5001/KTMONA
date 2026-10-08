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
/**
 * Round a number to 2 decimal places using banker's rounding.
 */
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
/**
 * Calculate GST breakdown for a single line item.
 *
 * @param input - Price, quantity, taxRate (percentage), and seller/buyer states
 * @returns GST breakdown with taxable amount, CGST, SGST, IGST, and total
 */
export function calculateGST(input) {
    const taxable = round2(input.price * input.quantity);
    const tax = round2((taxable * input.taxRate) / 100);
    // Zero tax → all fields zero except taxable and total
    if (tax === 0) {
        return {
            taxableAmount: taxable,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalAmount: taxable,
        };
    }
    const isIntraState = !input.buyerState ||
        input.sellerState.toLowerCase().trim() === input.buyerState.toLowerCase().trim();
    if (isIntraState) {
        // Intra-state: split equally into CGST + SGST
        const half = round2(tax / 2);
        return {
            taxableAmount: taxable,
            cgstAmount: half,
            sgstAmount: half,
            igstAmount: 0,
            totalAmount: round2(taxable + tax),
        };
    }
    // Inter-state: full IGST
    return {
        taxableAmount: taxable,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: tax,
        totalAmount: round2(taxable + tax),
    };
}
//# sourceMappingURL=gst.util.js.map