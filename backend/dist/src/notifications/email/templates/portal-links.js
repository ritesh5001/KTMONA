import { env } from '../../../config/env.js';
function normalizeUrl(url) {
    return url.replace(/\/+$/, '');
}
const frontendBaseUrl = normalizeUrl(env.FRONTEND_BASE_URL ?? 'http://localhost:3000');
const sellerBaseUrl = normalizeUrl(env.SELLER_BASE_URL ?? frontendBaseUrl);
export const portalLinks = {
    adminDashboard: `${frontendBaseUrl}/admin`,
    userOrders: `${frontendBaseUrl}/user/orders`,
    sellerDashboard: `${sellerBaseUrl}/seller/dashboard`,
    sellerOrders: `${sellerBaseUrl}/seller/orders`,
    sellerProducts: `${sellerBaseUrl}/seller/products`,
};
//# sourceMappingURL=portal-links.js.map