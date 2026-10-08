export function calculateMargin(sellerPrice: number, adminPrice: number) {
    const margin = adminPrice - sellerPrice;
    const percentage = sellerPrice > 0 ? (margin / sellerPrice) * 100 : 0;
    return {
        margin,
        percentage,
    };
}
