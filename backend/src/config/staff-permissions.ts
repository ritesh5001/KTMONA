/**
 * Admin-panel sections an employee can be granted.
 *
 * Full ADMIN / SUPER_ADMIN accounts have every section. Employees (admin
 * accounts created from Admin → Employees) only reach the API paths of the
 * sections they were given. The frontend mirrors these keys to hide menu
 * items, but the API check below is the one that matters.
 */

export const STAFF_PERMISSIONS = [
    { key: 'dashboard', label: 'Dashboard & analytics', description: 'Dashboard numbers, analytics and reports.' },
    { key: 'sellers', label: 'Sellers', description: 'Approve sellers, review KYC, suspend / reactivate accounts.' },
    { key: 'catalog', label: 'Catalog & pricing', description: 'Catalog QC, products, listing prices, moderation, Price Lock.' },
    { key: 'categories', label: 'Categories & collections', description: 'Category tree and curated collections.' },
    { key: 'orders', label: 'Orders & returns', description: 'Orders, cancellations, returns, refunds, dispatch SLA, seller claims.' },
    { key: 'finance', label: 'Payments & payouts', description: 'Payments, payouts, settlements, commissions, penalties.' },
    { key: 'marketing', label: 'Marketing', description: 'Sale events, ads, coupons, bestsellers, reels, reviews.' },
    { key: 'content', label: 'Website content', description: 'Homepage banners, seller notices, notifications, careers, investors, app & social links.' },
    { key: 'support', label: 'Support', description: 'Support tickets and video-call appointments.' },
    { key: 'settings', label: 'Platform settings', description: 'Shipping / GST switches and security settings.' },
    { key: 'activity', label: 'Activity log', description: 'View the record of every change made on the website.' },
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number]['key'];

export const STAFF_PERMISSION_KEYS = STAFF_PERMISSIONS.map((p) => p.key) as StaffPermission[];

/** Paths any admin account may call, whatever its sections. */
const ALWAYS_ALLOWED: RegExp[] = [
    /^\/v1\/admin\/me(\/|$)/,
    /^\/v1\/admin\/notifications(\/|$)/,
    /^\/v1\/imagekit(\/|$)/,
];

/**
 * API path → section. First match wins. A path an employee calls that matches
 * nothing here is refused: new admin endpoints are closed to employees until
 * they are mapped, never silently open.
 */
const PATH_RULES: [RegExp, StaffPermission][] = [
    [/^\/v1\/admin\/(stats|analytics)(\/|$)/, 'dashboard'],
    [/^\/v1\/admin\/center\/dashboard(\/|$)/, 'dashboard'],

    [/^\/v1\/admin\/(center\/)?sellers(\/|$)/, 'sellers'],
    [/^\/v1\/appointments\/admin\/block-seller/, 'sellers'],

    [/^\/v1\/admin\/center\/(qc|price-lock)(\/|$)/, 'catalog'],
    [/^\/v1\/admin\/products(\/|$)/, 'catalog'],

    [/^\/v1\/admin\/(categories|occasions)(\/|$)/, 'categories'],

    [/^\/v1\/admin\/(orders|refunds|shipments|seller-claims)(\/|$)/, 'orders'],
    [/^\/v1\/admin\/center\/sla(\/|$)/, 'orders'],
    [/^\/v1\/(cancellations|returns|orders)(\/|$)/, 'orders'],

    [/^\/v1\/admin\/(payments|settlements|commission-rules)(\/|$)/, 'finance'],
    [/^\/v1\/admin\/center\/(payouts|penalties)(\/|$)/, 'finance'],
    [/^\/v1\/seller\/settlements(\/|$)/, 'finance'],

    [/^\/v1\/admin\/(coupons|bestsellers|reviews|reels)(\/|$)/, 'marketing'],
    [/^\/v1\/admin\/center\/(campaigns|ads)(\/|$)/, 'marketing'],

    [/^\/v1\/admin\/center\/(storefront|announcements)(\/|$)/, 'content'],
    [/^\/v1\/admin\/site(\/|$)/, 'content'],

    [/^\/v1\/(support|appointments)(\/|$)/, 'support'],

    [/^\/v1\/admin\/(settings|audit-logs)(\/|$)/, 'settings'],

    [/^\/v1\/admin\/activity(\/|$)/, 'activity'],
];

/**
 * The section an API path belongs to: `'always'` for paths every admin may
 * call, null for paths employees may not call at all (e.g. managing
 * employees, which only full admins can do).
 */
export function permissionForPath(path: string): StaffPermission | 'always' | null {
    if (ALWAYS_ALLOWED.some((re) => re.test(path))) return 'always';
    for (const [re, permission] of PATH_RULES) {
        if (re.test(path)) return permission;
    }
    return null;
}
