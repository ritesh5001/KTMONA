import { EmailTemplateResult } from '../../types.js';
import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';

/** Sent right after a seller verifies their email: the application is waiting for admin approval. */
export function sellerApplicationSubmittedTemplate(data: { sellerEmail: string }): EmailTemplateResult {
    return {
        subject: 'Your KTMONA seller application has been submitted',
        html: renderBrandedEmail({
            preheader: 'We have received your seller application and it is now waiting for approval.',
            eyebrow: 'Seller Application',
            title: 'Application Submitted',
            message: [
                'Thank you for registering as a seller on KTMONA. Your email is verified and your application has been submitted for approval.',
                'Our team will review it shortly. We will email you as soon as your seller account is approved, and you can then sign in and start listing products.',
            ],
            details: [
                { label: 'Seller Account', value: data.sellerEmail },
                { label: 'Status', value: 'Pending approval' },
            ],
            ctaLabel: 'Seller Login',
            ctaUrl: portalLinks.sellerLogin,
        }),
    };
}
