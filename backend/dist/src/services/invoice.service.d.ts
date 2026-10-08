/**
 * Generate a GST-compliant PDF invoice buffer for a given order.
 *
 * @param orderId - The order ID to generate an invoice for
 * @returns Buffer containing the PDF bytes
 */
export declare function generateInvoicePDF(orderId: string): Promise<Buffer>;
/**
 * Increment download counter (called by controller)
 */
export declare function recordInvoiceDownload(): void;
//# sourceMappingURL=invoice.service.d.ts.map