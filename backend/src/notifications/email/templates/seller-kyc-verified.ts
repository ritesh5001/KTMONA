import { EmailTemplateResult } from '../../types.js';
import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';

/** Sent when an admin verifies a seller's KYC: they can now list products. */
export function sellerKycVerifiedTemplate(data: { sellerEmail: string; storeName?: string | null }): EmailTemplateResult {
    return {
        subject: 'Your KYC is verified: you can now list products on KTMONA',
        html: renderBrandedEmail({
            preheader: 'Your KYC is verified. Start listing your products on KTMONA.',
            eyebrow: 'Seller KYC',
            title: 'KYC Verified',
            message: [
                `Good news${data.storeName ? `, ${data.storeName}` : ''}. Our team has verified your KYC.`,
                'You can now list your products on KTMONA. Each product is checked by our team before it goes live.',
            ],
            details: [
                { label: 'Seller Account', value: data.sellerEmail },
                { label: 'KYC Status', value: 'Verified' },
            ],
            ctaLabel: 'Add Your First Product',
            ctaUrl: portalLinks.sellerNewProduct,
        }),
    };
}
