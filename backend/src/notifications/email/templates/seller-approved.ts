import { EmailTemplateResult } from '../../types.js';
import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';

/**
 * Sent when an admin approves a seller account. Unless the seller is already
 * KYC-verified (or exempt), it tells them KYC is the next step before they can
 * list products.
 */
export function sellerApprovedTemplate(data: { sellerEmail?: string; kycPending?: boolean }): EmailTemplateResult {
    // Older queued notifications have no flag: treat them as KYC still pending.
    const kycPending = data.kycPending !== false;
    return {
        subject: kycPending ? 'Your KTMONA seller account is approved: complete your KYC' : 'Your KTMONA seller account is approved',
        html: renderBrandedEmail({
            preheader: kycPending
                ? 'Your seller account is approved. Complete your KYC to start listing products.'
                : 'Your seller profile is now active on KTMONA.',
            eyebrow: 'Seller Account',
            title: 'Seller Account Approved',
            message: kycPending
                ? [
                      'Congratulations. Your seller account has been approved by our admin team.',
                      'Next step: complete your KYC. Sign in to the seller panel, open Settings, and add your business, GST/PAN and bank details.',
                      'Our team will verify your KYC, usually within 1–2 business days. We will email you once it is verified, and you can then start listing products.',
                  ]
                : [
                      'Congratulations. Your seller account has been approved by our admin team.',
                      'You can now list products and start fulfilling orders from your seller dashboard.',
                  ],
            details: [
                ...(data.sellerEmail ? [{ label: 'Approved Account', value: data.sellerEmail }] : []),
                ...(kycPending ? [{ label: 'Next Step', value: 'Complete your KYC' }] : []),
            ],
            ctaLabel: kycPending ? 'Complete KYC' : 'Go To Seller Dashboard',
            ctaUrl: kycPending ? portalLinks.sellerSettings : portalLinks.sellerDashboard,
        }),
    };
}
