import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';
export function sellerApprovedTemplate(data) {
    return {
        subject: 'Your Tatvivah seller account is approved',
        html: renderBrandedEmail({
            preheader: 'Your seller profile is now active on Tatvivah.',
            eyebrow: 'Seller Account',
            title: 'Seller Account Approved',
            message: [
                'Congratulations. Your seller account has been approved by our admin team.',
                'You can now list products and start fulfilling orders from your seller dashboard.',
            ],
            details: data.sellerEmail ? [{ label: 'Approved Account', value: data.sellerEmail }] : [],
            ctaLabel: 'Go To Seller Dashboard',
            ctaUrl: portalLinks.sellerDashboard,
        }),
    };
}
//# sourceMappingURL=seller-approved.js.map