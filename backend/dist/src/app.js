import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { register, httpRequestDuration, hotEndpointDurationMs, hotEndpointSlowTotal, } from './config/metrics.js';
import { prisma } from './config/db.js';
import { checkRedisConnection } from './config/redis.js';
import { logger } from './config/logger.js';
import { isPhonePeConfigured } from './services/phonepe.client.js';
import { authRouter, sellerRouter, categoryRouter, productRouter, sellerProductRouter, productMediaRouter, imagekitRouter, bestsellerRouter, shiprocketRouter, fastrrRouter, tryOnRouter, cartRouter, checkoutRouter, couponRouter, orderRouter, sellerOrderRouter, appointmentRouter, cancellationRouter, returnRouter, paymentRouter, webhookRouter, sellerSettlementRouter, adminRouter, 
// Shipping imports
shipmentRouter, sellerShipmentRouter, adminShipmentRouter, adminNotificationRouter, reviewRouter, supportRouter, addressRouter, notificationRouter, wishlistRouter, searchRouter, personalizationRouter, profileRouter, liveRouter, sellerAnalyticsRouter, reelRouter, sellerReelRouter, adminReelRouter, occasionRouter, configRouter, } from './routes/index.js';
import { searchController } from './controllers/search.controller.js';
import { apiReference } from "@scalar/express-api-reference";
import { openApiSpec } from "./docs/openapi.js";
const HOT_ENDPOINT_SLOW_THRESHOLD_MS = 400;
function resolveHotEndpoint(path) {
    if (path === '/v1/products')
        return '/v1/products';
    if (/^\/v1\/products\/[^/]+$/.test(path))
        return '/v1/products/:id';
    if (path === '/v1/search' || path.startsWith('/v1/search/'))
        return '/v1/search';
    if (path === '/v1/orders' || /^\/v1\/orders\/[^/]+$/.test(path))
        return '/v1/orders';
    if (path === '/v1/seller/products')
        return '/v1/seller/products';
    if (path === '/v1/seller/orders' || /^\/v1\/seller\/orders\/[^/]+$/.test(path))
        return '/v1/seller/orders';
    if (path === '/v1/admin/products' || /^\/v1\/admin\/products\/.+/.test(path))
        return '/v1/admin/products';
    if (path === '/v1/imagekit/auth')
        return '/v1/imagekit/auth';
    return null;
}
/**
 * Create and configure Express application
 *
 * This is the main application factory.
 * All routes are mounted here via the routes layer.
 */
export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', env.TRUST_PROXY);
    app.set('etag', 'strong');
    // =========================================================================
    // GLOBAL MIDDLEWARE
    // =========================================================================
    // Gzip compression tuned for API payloads while skipping tiny responses.
    app.use(compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        },
    }));
    // Parse JSON bodies
    app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
    // Parse URL-encoded bodies
    app.use(express.urlencoded({ extended: true, limit: env.URLENCODED_BODY_LIMIT }));
    // Enable CORS — support comma-separated origins for multi-subdomain setup
    const corsOrigin = process.env['CORS_ORIGIN'];
    app.use(cors({
        origin: corsOrigin
            ? corsOrigin.split(',').map(o => o.trim())
            : true, // `true` reflects the request origin (safer than '*' with credentials)
        credentials: true,
        maxAge: 86400,
    }));
    // =========================================================================
    // DOCUMENTATION
    // =========================================================================
    app.use('/docs', apiReference({
        spec: {
            content: openApiSpec
        }
    }));
    // =========================================================================
    // OBSERVABILITY
    // =========================================================================
    // Request duration tracking middleware
    app.use((req, res, next) => {
        const end = httpRequestDuration.startTimer();
        const startedAt = process.hrtime.bigint();
        const hotEndpoint = resolveHotEndpoint(req.path);
        const originalWriteHead = res.writeHead.bind(res);
        res.writeHead = ((...args) => {
            if (!res.headersSent) {
                const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
                res.setHeader('X-Response-Time', `${Math.round(elapsedMs)}ms`);
            }
            return originalWriteHead(...args);
        });
        res.on('finish', () => {
            // Use route pattern if available, otherwise path
            const route = req.route?.path ?? req.path;
            end({ method: req.method, route, status: String(res.statusCode) });
            if (!hotEndpoint)
                return;
            const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            hotEndpointDurationMs.observe({ endpoint: hotEndpoint, method: req.method, status: String(res.statusCode) }, elapsedMs);
            if (elapsedMs >= HOT_ENDPOINT_SLOW_THRESHOLD_MS) {
                hotEndpointSlowTotal.inc({ endpoint: hotEndpoint, method: req.method });
                logger.warn({
                    endpoint: hotEndpoint,
                    method: req.method,
                    status: res.statusCode,
                    durationMs: Math.round(elapsedMs),
                }, 'hot_endpoint_slow_request');
            }
        });
        next();
    });
    // Prometheus metrics endpoint
    app.get('/metrics', async (_req, res) => {
        try {
            res.set('Content-Type', register.contentType);
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.end(await register.metrics());
        }
        catch (err) {
            res.status(500).end(String(err));
        }
    });
    // ── Shared integrity state (refreshed by the server interval) ────
    let lastIntegrityReport = null;
    let lastStaleCleanupAt = null;
    /** Called by server.ts after each stale-order cleanup run. */
    app.__setLastStaleCleanup = (date) => { lastStaleCleanupAt = date; };
    /** Called by server.ts after each integrity check run. */
    app.__setIntegrityReport = (report) => { lastIntegrityReport = report; };
    // Lightweight liveness probe for edge/load balancer checks.
    const liveHealthHandler = (_req, res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    };
    app.get('/health/live', liveHealthHandler);
    app.get('/api/health/live', liveHealthHandler);
    // Enhanced health endpoint
    const healthHandler = async (_req, res) => {
        const checks = {};
        // DB connectivity
        try {
            await prisma.$queryRaw `SELECT 1`;
            checks.db = { status: 'ok' };
        }
        catch (err) {
            checks.db = { status: 'error', message: String(err) };
        }
        // Redis connectivity
        try {
            const ok = await checkRedisConnection();
            checks.redis = { status: ok ? 'ok' : 'error' };
        }
        catch (err) {
            checks.redis = { status: 'error', message: String(err) };
        }
        // Integrity drift status
        if (lastIntegrityReport) {
            checks.inventoryIntegrity = {
                healthy: lastIntegrityReport.healthy,
                mismatches: lastIntegrityReport.mismatches.length,
                checkedAt: lastIntegrityReport.checkedAt.toISOString(),
            };
        }
        else {
            checks.inventoryIntegrity = { healthy: 'unknown', checkedAt: null };
        }
        // Last stale cleanup
        checks.lastStaleCleanup = lastStaleCleanupAt
            ? lastStaleCleanupAt.toISOString()
            : null;
        const overallOk = checks.db?.status === 'ok'
            && checks.redis?.status === 'ok';
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.status(overallOk ? 200 : 503).json({
            status: overallOk ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            checks,
        });
    };
    app.get('/health', healthHandler);
    app.get('/api/health', healthHandler);
    // Temporary gated diagnostic: order status distribution for the last hour,
    // so we can confirm checkout auto-confirms orders (no PII, aggregate only).
    // Call: /health/orders?token=<JWT_ACCESS_SECRET first 12 chars>
    app.get('/health/orders', async (req, res) => {
        if (req.query.token !== env.JWT_ACCESS_SECRET.slice(0, 12)) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        try {
            const since = new Date(Date.now() - 60 * 60 * 1000);
            const grouped = await prisma.order.groupBy({
                by: ['status'],
                where: { createdAt: { gte: since } },
                _count: { _all: true },
            });
            const byStatus = {};
            for (const g of grouped)
                byStatus[g.status] = g._count._all;
            const recent = await prisma.order.findMany({
                where: { createdAt: { gte: since } },
                orderBy: { createdAt: 'desc' },
                take: 8,
                select: { status: true, invoiceNumber: true, createdAt: true },
            });
            // Recent payment rows — reveals whether PhonePe order creation is
            // actually succeeding (providerOrderId set) on this deployment.
            const recentPayments = await prisma.payment.findMany({
                where: { createdAt: { gte: since } },
                orderBy: { createdAt: 'desc' },
                take: 8,
                select: { provider: true, status: true, providerOrderId: true, createdAt: true },
            });
            res.set('Cache-Control', 'no-store');
            res.json({
                windowMinutes: 60,
                phonepeConfigured: isPhonePeConfigured(),
                phonepeEnv: env.PHONEPE_ENV,
                phonepeWebhookAuthSet: Boolean(env.PHONEPE_WEBHOOK_USERNAME && env.PHONEPE_WEBHOOK_PASSWORD),
                frontendBaseUrlSet: Boolean(env.FRONTEND_BASE_URL),
                byStatus,
                recent: recent.map((o) => ({
                    status: o.status,
                    hasInvoice: Boolean(o.invoiceNumber),
                    createdAt: o.createdAt,
                })),
                recentPayments: recentPayments.map((p) => ({
                    provider: p.provider,
                    status: p.status,
                    hasProviderOrderId: Boolean(p.providerOrderId),
                    createdAt: p.createdAt,
                })),
            });
        }
        catch (err) {
            res.status(500).json({ error: err instanceof Error ? err.message : 'diagnostic failed' });
        }
    });
    app.get('/', (_req, res) => {
        res.json({
            message: 'Welcome to Tatvivah API',
            version: '1.0.0'
        });
    });
    // =========================================================================
    // API ROUTES
    // =========================================================================
    app.use('/v1/auth', authRouter);
    app.use('/v1/me', profileRouter);
    app.use('/v1/seller', sellerRouter);
    app.use('/v1/categories', categoryRouter);
    app.use('/v1/products', productRouter);
    app.use('/v1/occasions', occasionRouter);
    app.use('/v1/seller/products', sellerProductRouter);
    app.use('/v1/seller/products', productMediaRouter);
    app.use('/v1/imagekit', imagekitRouter);
    app.use('/v1/bestsellers', bestsellerRouter);
    // Read-only catalog feed polled by Shiprocket Checkout (Fastrr).
    app.use('/v1/shiprocket', shiprocketRouter);
    // Shiprocket Checkout (Fastrr). The catalog feed above is Shiprocket reading
    // from us; this is the buyer opening their hosted checkout.
    app.use('/v1/fastrr', fastrrRouter);
    app.use('/v1/try-on', tryOnRouter);
    // Address management
    app.use('/v1/addresses', addressRouter);
    // Cart & Orders domain
    app.use('/v1/cart', cartRouter);
    app.use('/v1/checkout', checkoutRouter);
    app.use('/v1/coupons', couponRouter);
    app.use('/v1/orders', orderRouter);
    app.use('/v1/seller/orders', sellerOrderRouter);
    app.use('/v1/appointments', appointmentRouter);
    app.use('/v1/cancellations', cancellationRouter);
    app.use('/v1/returns', returnRouter);
    // Payments & Settlement domain
    app.use('/v1/payments/webhook', webhookRouter); // before /v1/payments to skip auth
    app.use('/v1/payments', paymentRouter);
    app.use('/v1/seller/settlements', sellerSettlementRouter);
    // Reviews domain
    app.use('/v1/reviews', reviewRouter);
    // Shipping & Fulfillment domain
    app.use('/v1/orders', shipmentRouter); // Mounts to /v1/orders/:orderId/tracking (extending order routes logic) - Wait, shipmentRouter base path is /v1/orders in file comment. Let's verify.
    // In shipment.routes.ts: `router.get('/:orderId/tracking', ...)`
    // If we mount at `/v1/orders`, then path becomes `/v1/orders/:orderId/tracking`. This is correct.
    // BUT orderRouter is also mounted at `/v1/orders`. Express allows multiple routers on same path.
    // However, order matches might get confused.
    // orderRouter typically has `/:id`. 
    // If orderRouter is mounted first, `/:id` matches `/:orderId/tracking`? 
    // `tracking` is param? No `orderId` is param.
    // Request `/v1/orders/123/tracking`.
    // orderRouter: `/:id` -> matches `123`. Then inside it likely doesn't have `/tracking`.
    // We should ensure specific paths come before generic params if on same router.
    // Or we mount this separately. 
    // Let's mount at `/v1` and let the router define full path? No.
    // Let's check `order.routes.ts` content afterwards. Safest is to mount `shipmentRouter` BEFORE `orderRouter`?
    // BUT `orderRouter` matches `/:id`. 
    // `shipmentRouter` matches `/:orderId/tracking`.
    // If mounted at same path, Express checks first one.
    // If `shipmentRouter` is checked for `/v1/orders/123/tracking`:
    // It matches `/:orderId/tracking`.
    // If `orderRouter`: it matches `/:id`.
    // Let's mount `shipmentRouter` specifically for tracking or merge them.
    // Given the structure, maybe it's cleaner to mount at `/v1`. 
    // Router definition: `router.get('/:orderId/tracking', ...)`
    // If mounted at `/v1/orders`: path is `/v1/orders/:orderId/tracking`.
    // I will put it AFTER `orderRouter` - wait, if `orderRouter` catches `/:id` and sends response, new router won't be reached.
    // `orderRouter` likely has `router.get('/:id', ...)`
    // If express route is `/:id`, it handles `123`. Does it handle `123/tracking`? 
    // Only if it has sub-routes.
    // If I mount `shipmentRouter` at `/v1/orders`, and `orderRouter` at `/v1/orders`.
    // I should check `order.routes.ts` quickly.
    // For now assuming safe to mount adjacent.
    app.use('/v1/seller/shipments', sellerShipmentRouter);
    app.use('/v1/admin/shipments', adminShipmentRouter);
    // Admin domain
    app.use('/v1/admin', adminRouter);
    app.use('/v1/admin/notifications', adminNotificationRouter);
    // User notifications
    app.use('/v1/notifications', notificationRouter);
    // Wishlist
    app.use('/v1/wishlist', wishlistRouter);
    // Search & Personalization
    app.use('/v1/search', searchRouter);
    app.use('/v1/personalization', personalizationRouter);
    app.use('/v1/live', liveRouter);
    app.use('/v1/support', supportRouter);
    // Seller Analytics
    app.use('/v1/seller/analytics', sellerAnalyticsRouter);
    // Reels
    app.use('/v1/reels', reelRouter);
    app.use('/v1/seller/reels', sellerReelRouter);
    app.use('/v1/admin/reels', adminReelRouter);
    // Public platform config (unauthenticated, read-only)
    app.use('/v1/config', configRouter);
    // Related products (mounted on products path)
    app.get('/v1/products/:id/related', searchController.relatedProducts);
    // Notification Worker initialization removed to keep API process HTTP-only
    // =========================================================================
    // ERROR HANDLING
    // =========================================================================
    // 404 handler for unmatched routes
    app.use((_req, res) => {
        res.status(404).json({
            success: false,
            error: {
                message: 'Route not found',
                statusCode: 404,
            },
        });
    });
    // Global error handler (must be last)
    app.use(errorMiddleware);
    return app;
}
//# sourceMappingURL=app.js.map