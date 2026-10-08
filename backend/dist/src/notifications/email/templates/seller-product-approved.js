import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';
export function sellerProductApprovedTemplate(meta) {
    const productTitle = meta?.productTitle ?? 'your product';
    return {
        subject: 'Product Approved',
        html: renderBrandedEmail({
            preheader: `${productTitle} has been approved and published.`,
            eyebrow: 'Product Moderation',
            title: 'Product Approved',
            message: [
                `Your product ${productTitle} has passed moderation and is now visible in the marketplace.`,
                'You can monitor performance and orders from your dashboard.',
            ],
            details: [{ label: 'Product', value: productTitle }],
            ctaLabel: 'Manage Products',
            ctaUrl: portalLinks.sellerProducts,
        }),
    };
}
//# sourceMappingURL=seller-product-approved.js.map