import { EmailTemplateResult } from '../../types.js';
import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';

/** Sent when an admin rejects a seller's KYC, with the reason to fix. */
export function sellerKycRejectedTemplate(data: { sellerEmail: string; reason: string }): EmailTemplateResult {
    return {
        subject: 'Action needed: your KTMONA KYC was not approved',
        html: renderBrandedEmail({
            preheader: 'Please correct your KYC details and resubmit.',
            eyebrow: 'Seller KYC',
            title: 'KYC Not Approved',
            message: [
                'Our team could not verify your KYC details.',
                'Please correct them in the seller panel under Settings and resubmit. You can list products once your KYC is verified.',
            ],
            details: [
                { label: 'Seller Account', value: data.sellerEmail },
                { label: 'Reason', value: data.reason },
            ],
            ctaLabel: 'Fix KYC Details',
            ctaUrl: portalLinks.sellerSettings,
        }),
    };
}
