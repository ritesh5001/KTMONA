/**
 * Storefront traffic for the admin Analytics page: website visitors, seller
 * sign-up attempts and product views, for any date range.
 *
 * The browser keeps a random visitor id and reports events; each is stored
 * once per visitor, per day (per product for product views), so the numbers
 * are unique visitors rather than raw hits. Product page hits are also
 * counted separately in `product_view_daily` (seller Business Insights).
 */

import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';

export const SITE_EVENT_TYPES = ['VISIT', 'SELLER_SIGNUP_VIEW', 'SELLER_SIGNUP_SUBMIT', 'PRODUCT_VIEW'] as const;

export const trackEventSchema = z.object({
    type: z.enum(SITE_EVENT_TYPES),
    visitorId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Invalid visitor id'),
    productId: z.string().min(1).max(191).optional(),
});

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|curl|wget|python|axios|node-fetch/i;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

function utcDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDay(value: unknown, fallback: Date): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw ApiError.badRequest(`Invalid date: ${value}`);
    return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

class SiteAnalyticsService {
    /** Fire-and-forget from the browser. Bots and repeats are dropped quietly. */
    async track(input: z.infer<typeof trackEventSchema>, userId: string | null, userAgent: string | undefined) {
        if (!userAgent || BOT_UA.test(userAgent)) return;
        let productId = '';
        if (input.type === 'PRODUCT_VIEW') {
            if (!input.productId) return;
            const product = await prisma.product.findFirst({
                where: { OR: [{ id: input.productId }, { slug: input.productId }] },
                select: { id: true },
            });
            if (!product) return;
            productId = product.id;
        }
        await prisma.siteEvent.createMany({
            data: [{ type: input.type, visitorId: input.visitorId, userId, productId, day: utcDay(new Date()) }],
            skipDuplicates: true,
        });
    }

    /**
     * Totals and a day-by-day series for [from, to] (inclusive, UTC days).
     * Defaults to the last 30 days.
     */
    async report(query: Record<string, unknown>) {
        const today = utcDay(new Date());
        const to = parseDay(query.to, today);
        const from = parseDay(query.from, new Date(to.getTime() - 29 * DAY_MS));
        if (from > to) throw ApiError.badRequest('"From" date must be on or before the "to" date');
        if ((to.getTime() - from.getTime()) / DAY_MS + 1 > MAX_RANGE_DAYS) {
            throw ApiError.badRequest(`Choose a range of at most ${MAX_RANGE_DAYS} days`);
        }
        const end = new Date(to.getTime() + DAY_MS); // exclusive, for timestamps

        const [events, daily, productHits, sellers, customers, topProducts] = await Promise.all([
            // Unique visitors over the whole range, per event type.
            prisma.$queryRaw<{ type: string; visitors: bigint; users: bigint; rows: bigint }[]>`
                SELECT "type",
                       COUNT(DISTINCT "visitor_id") AS "visitors",
                       COUNT(DISTINCT "user_id") AS "users",
                       COUNT(*) AS "rows"
                FROM "site_events"
                WHERE "day" >= ${from}::date AND "day" <= ${to}::date
                GROUP BY "type"`,
            prisma.$queryRaw<{ day: Date; type: string; visitors: bigint }[]>`
                SELECT "day", "type", COUNT(DISTINCT "visitor_id") AS "visitors"
                FROM "site_events"
                WHERE "day" >= ${from}::date AND "day" <= ${to}::date
                GROUP BY "day", "type"`,
            prisma.productViewDaily.groupBy({
                by: ['day'],
                where: { day: { gte: from, lte: to } },
                _sum: { views: true },
            }),
            prisma.$queryRaw<{ day: Date; n: bigint }[]>`
                SELECT date_trunc('day', "created_at")::date AS "day", COUNT(*) AS "n"
                FROM "users"
                WHERE "role" = 'SELLER' AND "created_at" >= ${from} AND "created_at" < ${end}
                GROUP BY 1`,
            prisma.user.count({ where: { role: 'USER', createdAt: { gte: from, lt: end } } }),
            prisma.$queryRaw<{ productId: string; title: string | null; viewers: bigint; customers: bigint }[]>`
                SELECT e."product_id" AS "productId", p."title" AS "title",
                       COUNT(DISTINCT e."visitor_id") AS "viewers",
                       COUNT(DISTINCT e."user_id") AS "customers"
                FROM "site_events" e
                LEFT JOIN "products" p ON p."id" = e."product_id"
                WHERE e."type" = 'PRODUCT_VIEW' AND e."day" >= ${from}::date AND e."day" <= ${to}::date
                GROUP BY e."product_id", p."title"
                ORDER BY "viewers" DESC
                LIMIT 10`,
        ]);

        const byType = new Map(events.map((e) => [e.type, e]));
        const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
        const sellerSignups = sellers.reduce((sum, r) => sum + n(r.n), 0);

        const series = new Map<string, { day: string; visitors: number; productViews: number; productViewers: number; sellerSignupViews: number; sellerSignupSubmits: number; sellersRegistered: number }>();
        for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
            const day = iso(new Date(t));
            series.set(day, { day, visitors: 0, productViews: 0, productViewers: 0, sellerSignupViews: 0, sellerSignupSubmits: 0, sellersRegistered: 0 });
        }
        for (const r of daily) {
            const row = series.get(iso(r.day));
            if (!row) continue;
            if (r.type === 'VISIT') row.visitors = n(r.visitors);
            else if (r.type === 'PRODUCT_VIEW') row.productViewers = n(r.visitors);
            else if (r.type === 'SELLER_SIGNUP_VIEW') row.sellerSignupViews = n(r.visitors);
            else if (r.type === 'SELLER_SIGNUP_SUBMIT') row.sellerSignupSubmits = n(r.visitors);
        }
        for (const r of productHits) {
            const row = series.get(iso(r.day));
            if (row) row.productViews = r._sum.views ?? 0;
        }
        for (const r of sellers) {
            const row = series.get(iso(r.day));
            if (row) row.sellersRegistered = n(r.n);
        }

        return {
            from: iso(from),
            to: iso(to),
            totals: {
                /** Unique visitors to the website. */
                visitors: n(byType.get('VISIT')?.visitors),
                /** Visitor-days: a visitor coming back on another day counts again. */
                visits: n(byType.get('VISIT')?.rows),
                /** Opened the seller registration form. */
                sellerSignupViews: n(byType.get('SELLER_SIGNUP_VIEW')?.visitors),
                /** Submitted the form (OTP sent). */
                sellerSignupSubmits: n(byType.get('SELLER_SIGNUP_SUBMIT')?.visitors),
                /** Verified the OTP: seller accounts created. */
                sellersRegistered: sellerSignups,
                customersRegistered: customers,
                /** Product page views (every page load). */
                productViews: productHits.reduce((sum, r) => sum + (r._sum.views ?? 0), 0),
                /** Unique visitors who viewed at least one product. */
                productViewers: n(byType.get('PRODUCT_VIEW')?.visitors),
                /** Signed-in customers who viewed at least one product. */
                customersViewingProducts: n(byType.get('PRODUCT_VIEW')?.users),
            },
            series: [...series.values()],
            topProducts: topProducts.map((p) => ({
                productId: p.productId,
                title: p.title ?? 'Deleted product',
                viewers: n(p.viewers),
                customers: n(p.customers),
            })),
        };
    }
}

export const siteAnalyticsService = new SiteAnalyticsService();
export type SiteTrafficReport = Awaited<ReturnType<SiteAnalyticsService['report']>>;
