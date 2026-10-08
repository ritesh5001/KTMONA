import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';
export function sellerProductRejectedTemplate(meta) {
    const productTitle = meta?.productTitle ?? 'your product';
    const reason = meta?.reason ?? 'Please review and resubmit.';
    return {
        subject: 'Product Rejected',
        html: renderBrandedEmail({
            preheader: `${productTitle} needs revisions before approval.`,
            eyebrow: 'Product Moderation',
            title: 'Product Rejected',
            message: [
                `Your product ${productTitle} was reviewed and requires updates before it can go live.`,
                'Please address the moderation feedback and submit again.',
            ],
            details: [
                { label: 'Product', value: productTitle },
                { label: 'Reason', value: reason },
            ],
            ctaLabel: 'Edit Product',
            ctaUrl: portalLinks.sellerProducts,
            accentText: 'A clear correction on title, images, and compliance details typically speeds up re-approval.',
        }),
    };
}
//# sourceMappingURL=seller-product-rejected.js.map