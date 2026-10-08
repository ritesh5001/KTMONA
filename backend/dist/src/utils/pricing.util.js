export function calculateMargin(sellerPrice, adminPrice) {
    const margin = adminPrice - sellerPrice;
    const percentage = sellerPrice > 0 ? (margin / sellerPrice) * 100 : 0;
    return {
        margin,
        percentage,
    };
}
//# sourceMappingURL=pricing.util.js.map