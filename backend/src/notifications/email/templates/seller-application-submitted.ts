import { EmailTemplateResult } from '../../types.js';
import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';

/** Sent right after a seller verifies their email: the panel is open, KYC is the next step. */
export function sellerRegisteredTemplate(data: { sellerEmail: string }): EmailTemplateResult {
    return {
        subject: 'You have successfully registered on KTMONA – please complete your KYC',
        html: renderBrandedEmail({
            preheader: 'Your seller account is ready. Complete your KYC to start listing products.',
            eyebrow: 'Seller Registration',
            title: 'Welcome to KTMONA',
            message: [
                'You have successfully registered on KTMONA. Your seller panel is ready and you can sign in right away.',
                'Please complete your KYC (business, GST/PAN and bank details) from Settings in the seller panel. Once KTMONA verifies your KYC you can start listing products.',
            ],
            details: [
                { label: 'Seller Account', value: data.sellerEmail },
                { label: 'KYC Status', value: 'Pending – please complete your KYC' },
            ],
            ctaLabel: 'Complete KYC',
            ctaUrl: `${portalLinks.sellerSettings}?tab=business`,
        }),
    };
}
