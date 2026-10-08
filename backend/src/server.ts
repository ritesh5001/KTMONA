import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma, disconnectDatabase } from './config/db.js';
import { closeQueueResources } from './notifications/notification.queue.js';
import { paymentService } from './services/payment.service.js';
import { logger } from './config/logger.js';
import { runInventoryIntegrityCheck } from './jobs/inventoryIntegrity.js';
import { hashPassword } from './utils/password.util.js';
import { reelRepository } from './repositories/reel.repository.js';
import { warmCatalogCaches } from './services/catalog-warmup.service.js';
import { appointmentService } from './services/appointment.service.js';
import { fastrrOrderService } from './services/fastrr-order.service.js';
import { sellerPricingService } from './services/seller-center/pricing.service.js';
import { sellerAdsService } from './services/seller-center/ads.service.js';
import { sellerInsightsService } from './services/seller-center/insights.service.js';

/**
 * How often the consolidated maintenance sweep runs (30 minutes by default).
 *
 * Stale-order cleanup, the inventory integrity check, the appointment sweep and
 * Fastrr reconciliation used to be four separate timers at 5-15 minute offsets.
 * Neon suspends the compute after five minutes without a query, so one of them
 * always fired before that window closed: the database never once scaled to
 * zero, and billed around the clock for a 40 MB dataset.
 *
 * Running them together on one long cadence wakes the compute once per cycle
 * instead of pinning it awake. They run sequentially rather than in parallel —
 * they share a connection pool, and a maintenance sweep should not queue behind
 * itself for it.
 *
 * 30 minutes is safe for the tightest deadline in the set: an order only becomes
 * stale after STALE_ORDER_TTL_MS (also 30 minutes), so this now cancels one
 * between 30 and 60 minutes after it was placed rather than between 30 and 40.
 * Lower MAINTENANCE_INTERVAL_MS if that matters more than the compute bill;
 * raise it toward an hour to save more.
 *
 * Fastrr reconciliation is the failsafe Shiprocket's docs recommend for a lost
 * webhook or a buyer who closes the tab before being redirected back, so it is
 * unaffected by cadence beyond taking longer to notice.
 */
const MAINTENANCE_INTERVAL_MS = env.MAINTENANCE_INTERVAL_MS;

/** How often to flush buffered reel views (1 minute). */
const REEL_VIEW_FLUSH_INTERVAL_MS = 60 * 1000;

/** Max random jitter added to recurring job intervals (up to 1 minute). */
const JOB_JITTER_MAX_MS = 60 * 1000;
const WARMUP_REQUEST_TIMEOUT_MS = 8000;
/**
 * How often to refresh the storefront cache. Comfortably under the shortest
 * catalog TTL so entries are replaced before they expire, and cheap enough that
 * the extra queries are irrelevant next to the latency they save shoppers.
 *
 * This one stays frequent, but only while somebody is actually shopping — see
 * hasRecentTraffic(). Warming exists so a shopper is never the request that
 * refills the cache; with no shoppers there is nothing to protect, and firing
 * every four minutes was the single biggest reason the database could never
 * suspend. The first visitor after a long idle period pays one cold read, which
 * is the same cost a deploy already imposes, and the next tick re-warms.
 */
const CATALOG_WARMUP_INTERVAL_MS = 4 * 60 * 1000;
const DB_CONNECT_MAX_ATTEMPTS = 5;
const DB_CONNECT_BACKOFF_MS = 2500;
const STARTUP_DB_OPERATION_MAX_ATTEMPTS = 4;

function withIntervalJitter(baseMs: number): number {
    const jitter = Math.floor(Math.random() * JOB_JITTER_MAX_MS);
    return baseMs + jitter;
}

/**
 * When a real request last arrived.
 *
 * Seeded at boot so a freshly deployed instance keeps its cache warm for one
 * idle window rather than starting out cold.
 */
let lastRequestAt = Date.now();

/**
 * Liveness probes and this service's own warmup ping are not traffic.
 *
 * Render polls /health/live continuously and pingWarmupEndpoint() calls the
 * service's own public URL. Counting either as a shopper would make
 * hasRecentTraffic() permanently true and defeat the whole idle check — which
 * is exactly the trap the old always-on timers fell into.
 */
function isKeepAliveRequest(url: string | undefined, userAgent: string | undefined): boolean {
    if (userAgent?.startsWith('ktmona-backend-warmup/')) return true;
    if (!url) return false;
    const path = url.split('?')[0] ?? '';
    return path === '/health'
        || path === '/api/health'
        || path.startsWith('/health/')
        || path.startsWith('/api/health/');
}

/** Whether a shopper has hit the API recently enough to be worth warming for. */
function hasRecentTraffic(): boolean {
    return Date.now() - lastRequestAt < env.CATALOG_WARMUP_IDLE_AFTER_MS;
}

function shouldRunBackgroundJobs(): boolean {
    if (typeof env.RUN_BACKGROUND_JOBS === 'boolean') {
        return env.RUN_BACKGROUND_JOBS;
    }

    const pm2Instance = process.env['NODE_APP_INSTANCE'];
    return !pm2Instance || pm2Instance === '0';
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectDatabaseWithRetry(): Promise<void> {
    let attempt = 1;
    let lastError: unknown;

    while (attempt <= DB_CONNECT_MAX_ATTEMPTS) {
        try {
            await prisma.$connect();
            return;
        } catch (err) {
            lastError = err;
            const isLastAttempt = attempt === DB_CONNECT_MAX_ATTEMPTS;
            logger.warn(
                {
                    attempt,
                    maxAttempts: DB_CONNECT_MAX_ATTEMPTS,
                    error:
                        err instanceof Error
                            ? { name: err.name, message: err.message }
                            : String(err),
                },
                isLastAttempt ? 'Database connect retries exhausted' : 'Database connect failed, retrying',
            );

            if (isLastAttempt) break;
            await wait(DB_CONNECT_BACKOFF_MS * attempt);
            attempt += 1;
        }
    }

    throw lastError;
}

function isTransientDatabaseStartupError(err: unknown): boolean {
    if (!err) return false;

    const maybeCode = (err as { code?: string }).code;
    if (maybeCode === 'P1017') {
        return true;
    }

    const message =
        err instanceof Error
            ? err.message
            : typeof err === 'string'
                ? err
                : JSON.stringify(err);

    const normalized = message.toLowerCase();
    return (
        normalized.includes('server has closed the connection') ||
        normalized.includes('connection is closed') ||
        normalized.includes('connection reset') ||
        normalized.includes('forcibly closed by the remote host') ||
        normalized.includes('timeout')
    );
}

async function runStartupDbOperationWithRetry<T>(
    operationName: string,
    operation: () => Promise<T>
): Promise<T> {
    let attempt = 1;
    let lastError: unknown;

    while (attempt <= STARTUP_DB_OPERATION_MAX_ATTEMPTS) {
        try {
            return await operation();
        } catch (err) {
            lastError = err;
            const transient = isTransientDatabaseStartupError(err);
            const isLastAttempt = attempt === STARTUP_DB_OPERATION_MAX_ATTEMPTS;

            logger.warn(
                {
                    operation: operationName,
                    attempt,
                    maxAttempts: STARTUP_DB_OPERATION_MAX_ATTEMPTS,
                    transient,
                    error:
                        err instanceof Error
                            ? { name: err.name, message: err.message }
                            : String(err),
                },
                transient && !isLastAttempt
                    ? 'Startup DB operation failed transiently, retrying'
                    : 'Startup DB operation failed',
            );

            if (!transient || isLastAttempt) {
                break;
            }

            // Reset any stale connection state before retrying.
            await disconnectDatabase().catch(() => { });
            await connectDatabaseWithRetry();
            await wait(DB_CONNECT_BACKOFF_MS * attempt);
            attempt += 1;
        }
    }

    throw lastError;
}

/** Guard: only execute shutdown sequence once. */
let isShuttingDown = false;

const SUPER_ADMIN_EMAIL = 'rgiri5001@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Ritesh5001@';

async function ensureSuperAdminAccount(): Promise<void> {
    await runStartupDbOperationWithRetry('ensureSuperAdminAccount', async () => {
        const passwordHash = await hashPassword(SUPER_ADMIN_PASSWORD);

        const superAdminUser = await prisma.user.upsert({
            where: { email: SUPER_ADMIN_EMAIL },
            update: {
                passwordHash,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
                isEmailVerified: true,
                isPhoneVerified: false,
            },
            create: {
                email: SUPER_ADMIN_EMAIL,
                passwordHash,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
                isEmailVerified: true,
                isPhoneVerified: false,
            },
        });

        await prisma.superAdminProfile.upsert({
            where: { userId: superAdminUser.id },
            update: {},
            create: {
                userId: superAdminUser.id,
                firstName: 'Ritesh',
                lastName: 'Giri',
            },
        });
    });

    logger.info({ email: SUPER_ADMIN_EMAIL }, 'Super admin account ensured at startup');
}

async function pingWarmupEndpoint(): Promise<void> {
    if (!env.BACKEND_WARMUP_URL) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WARMUP_REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(env.BACKEND_WARMUP_URL, {
            method: 'GET',
            headers: { 'user-agent': 'ktmona-backend-warmup/1.0' },
            signal: controller.signal,
        });
        logger.debug({ status: response.status, url: env.BACKEND_WARMUP_URL }, 'Warmup ping completed');
    } catch (err) {
        logger.warn({ err, url: env.BACKEND_WARMUP_URL }, 'Warmup ping failed');
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Start the server
 */
async function bootstrap(): Promise<void> {
    try {
        // Verify database connection
        await connectDatabaseWithRetry();
        logger.info('Database connected successfully');

        // Ensure hardcoded super admin always exists in every environment
        await ensureSuperAdminAccount();

        // Create Express app
        const app = createApp();

        // Start server
        const server = app.listen(env.PORT,"0.0.0.0", () => {
            logger.info({ port: env.PORT, env: env.NODE_ENV }, `Server running on port ${env.PORT}`);
        });

        // Tune HTTP socket behavior for higher throughput and fewer reconnects.
        server.keepAliveTimeout = env.KEEP_ALIVE_TIMEOUT_MS;
        server.headersTimeout = env.HEADERS_TIMEOUT_MS;
        server.requestTimeout = env.REQUEST_TIMEOUT_MS;
        server.maxRequestsPerSocket = env.MAX_REQUESTS_PER_SOCKET;
        server.on('connection', (socket) => {
            socket.setNoDelay(true);
            socket.setKeepAlive(true);
        });

        // Record real traffic at the HTTP layer rather than as Express middleware,
        // so this stays out of the request-handling path entirely and cannot
        // affect routing or error handling.
        server.on('request', (req) => {
            if (!isKeepAliveRequest(req.url, req.headers['user-agent'])) {
                lastRequestAt = Date.now();
            }
        });

        const runBackgroundJobs = shouldRunBackgroundJobs();

        let maintenanceTimer: NodeJS.Timeout | null = null;
        let reelViewFlushTimer: NodeJS.Timeout | null = null;
        let warmupTimer: NodeJS.Timeout | null = null;
        let catalogWarmupTimer: NodeJS.Timeout | null = null;

        /**
         * The four database-touching maintenance jobs, run as one sweep.
         *
         * Sequential and individually guarded: one failing job must not stop the
         * three after it, which is why each has its own try/catch rather than a
         * single wrapper.
         */
        const runMaintenanceSweep = async (reason: 'startup' | 'interval'): Promise<void> => {
            try {
                const result = await paymentService.cancelStaleOrders();
                (app as any).__setLastStaleCleanup(new Date());
                if (result.cancelled > 0) {
                    logger.info({ cancelled: result.cancelled, total: result.total, reason }, 'Stale order cleanup completed');
                }
            } catch (err) {
                logger.error({ err }, 'Stale order cleanup error');
            }

            try {
                const report = await runInventoryIntegrityCheck();
                (app as any).__setIntegrityReport(report);
            } catch (err) {
                logger.error({ err }, 'Inventory integrity check error');
            }

            try {
                await appointmentService.autoCompletePastAppointments();
            } catch (err) {
                logger.warn({ err }, 'Appointment completion sweep error');
            }

            // A no-op unless Fastrr is configured.
            try {
                await fastrrOrderService.reconcilePendingSessions();
            } catch (err) {
                logger.warn({ err }, 'Fastrr reconciliation error');
            }

            // Seller center: start/end discount offers, bill ad spend into the
            // seller ledger, record late-dispatch penalties (if configured).
            try {
                await sellerPricingService.runOfferSchedule();
                await sellerAdsService.rollupSpendToLedger();
                await sellerInsightsService.runLateDispatchPenalties();
            } catch (err) {
                logger.warn({ err }, 'Seller center sweep error');
            }
        };

        let maintenanceInProgress = false;

        if (runBackgroundJobs) {
            maintenanceTimer = setInterval(() => {
                // A sweep that outruns its own interval would otherwise stack up
                // and hold several pooled connections at once.
                if (maintenanceInProgress) {
                    logger.warn('Maintenance sweep still running, skipping this tick');
                    return;
                }
                maintenanceInProgress = true;
                void runMaintenanceSweep('interval').finally(() => {
                    maintenanceInProgress = false;
                });
            }, withIntervalJitter(MAINTENANCE_INTERVAL_MS));
        }

        let reelFlushInProgress = false;

        const flushReelViews = async (reason: 'startup' | 'interval' | 'shutdown') => {
            if (reelFlushInProgress) {
                return;
            }

            reelFlushInProgress = true;
            try {
                const result = await reelRepository.flushReelViews();
                if (result.flushed > 0) {
                    logger.info({ reason, flushed: result.flushed }, 'Buffered reel views flushed');
                }
            } catch (err) {
                logger.error({ err, reason }, 'Reel view flush error');
            } finally {
                reelFlushInProgress = false;
            }
        };

        if (runBackgroundJobs) {
            // ---- Reel view buffer flush (runs every 1 min) ----
            reelViewFlushTimer = setInterval(() => {
                void flushReelViews('interval');
            }, withIntervalJitter(REEL_VIEW_FLUSH_INTERVAL_MS));

            warmupTimer = env.BACKEND_WARMUP_URL
                ? setInterval(() => {
                    void pingWarmupEndpoint();
                }, Math.max(60_000, env.BACKEND_WARMUP_INTERVAL_MS))
                : null;

            // Run once on startup (after a short delay to let connections settle)
            setTimeout(async () => {
                maintenanceInProgress = true;
                try {
                    await runMaintenanceSweep('startup');
                } finally {
                    maintenanceInProgress = false;
                }

                await flushReelViews('startup');
                await pingWarmupEndpoint();

                // Refill the storefront cache before real traffic arrives — a deploy
                // empties Redis, and a cold read costs seconds against a remote DB.
                try {
                    await warmCatalogCaches('startup');
                } catch (err) {
                    logger.warn({ err }, 'Initial catalog warmup error');
                }
            }, 5000);

            // Keep the storefront cache hot. Entries are also invalidated explicitly
            // on every product mutation, so this only guards against expiry — a
            // shopper should never be the request that refills the cache.
            //
            // Skipped once the site goes quiet: with nobody shopping there is no
            // cold read to prevent, and this was the query that kept Neon's
            // compute from ever suspending.
            catalogWarmupTimer = setInterval(() => {
                if (!hasRecentTraffic()) return;
                void warmCatalogCaches('interval').catch((err) => {
                    logger.warn({ err }, 'Catalog warmup error');
                });
            }, withIntervalJitter(CATALOG_WARMUP_INTERVAL_MS));
        } else {
            logger.info({ instance: process.env['NODE_APP_INSTANCE'] }, 'Background jobs disabled on this instance');
        }

        // ------------------------------------------------------------------
        // Graceful shutdown
        // ------------------------------------------------------------------

        const shutdown = async (signal: string): Promise<void> => {
            if (isShuttingDown) return;          // prevent re-entry on second SIGINT
            isShuttingDown = true;

            logger.info({ signal }, 'Shutting down gracefully…');

            if (maintenanceTimer) clearInterval(maintenanceTimer);
            if (reelViewFlushTimer) clearInterval(reelViewFlushTimer);
            if (warmupTimer) clearInterval(warmupTimer);
            if (catalogWarmupTimer) clearInterval(catalogWarmupTimer);

            server.close(async () => {
                logger.info('HTTP server closed');
                await flushReelViews('shutdown');
                await closeQueueResources().catch(() => {});
                await disconnectDatabase();
                process.exit(0);
            });

            // Force close after 10 seconds
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10_000).unref();             // .unref() so timer alone won't keep process alive
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.fatal({ err: error }, 'Failed to start server');
        await closeQueueResources().catch(() => {});
        await disconnectDatabase();
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// Process-wide crash handlers — ensures Prisma pool drains on unexpected exit
// ---------------------------------------------------------------------------

process.on('unhandledRejection', async (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection — shutting down');
    await disconnectDatabase();
    process.exit(1);
});

process.on('uncaughtException', async (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    await disconnectDatabase();
    process.exit(1);
});

// Start the application
bootstrap();
