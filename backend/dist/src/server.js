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
/** How often to run the stale-order cleanup (10 minutes). */
const STALE_ORDER_INTERVAL_MS = 10 * 60 * 1000;
/**
 * How often to reconcile in-flight Fastrr checkouts (15 minutes).
 *
 * Shiprocket's own docs recommend this as a failsafe: a lost webhook, or a buyer
 * who closes the tab before being redirected back, would otherwise leave a paid
 * order that never exists in this database.
 */
const FASTRR_RECONCILE_INTERVAL_MS = 15 * 60 * 1000;
/** How often to run the inventory integrity check (10 minutes). */
const INTEGRITY_CHECK_INTERVAL_MS = 10 * 60 * 1000;
/** How often to flush buffered reel views (1 minute). */
const REEL_VIEW_FLUSH_INTERVAL_MS = 60 * 1000;
/** Max random jitter added to recurring job intervals (up to 1 minute). */
const JOB_JITTER_MAX_MS = 60 * 1000;
const WARMUP_REQUEST_TIMEOUT_MS = 8000;
/**
 * How often to refresh the storefront cache. Comfortably under the shortest
 * catalog TTL so entries are replaced before they expire, and cheap enough that
 * the extra queries are irrelevant next to the latency they save shoppers.
 */
const CATALOG_WARMUP_INTERVAL_MS = 4 * 60 * 1000;
/**
 * How often to sweep finished appointments to COMPLETED. This used to run inline
 * on every appointment list request — a full-table scan plus writes on a read path.
 */
const APPOINTMENT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const DB_CONNECT_MAX_ATTEMPTS = 5;
const DB_CONNECT_BACKOFF_MS = 2500;
const STARTUP_DB_OPERATION_MAX_ATTEMPTS = 4;
function withIntervalJitter(baseMs) {
    const jitter = Math.floor(Math.random() * JOB_JITTER_MAX_MS);
    return baseMs + jitter;
}
function shouldRunBackgroundJobs() {
    if (typeof env.RUN_BACKGROUND_JOBS === 'boolean') {
        return env.RUN_BACKGROUND_JOBS;
    }
    const pm2Instance = process.env['NODE_APP_INSTANCE'];
    return !pm2Instance || pm2Instance === '0';
}
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function connectDatabaseWithRetry() {
    let attempt = 1;
    let lastError;
    while (attempt <= DB_CONNECT_MAX_ATTEMPTS) {
        try {
            await prisma.$connect();
            return;
        }
        catch (err) {
            lastError = err;
            const isLastAttempt = attempt === DB_CONNECT_MAX_ATTEMPTS;
            logger.warn({
                attempt,
                maxAttempts: DB_CONNECT_MAX_ATTEMPTS,
                error: err instanceof Error
                    ? { name: err.name, message: err.message }
                    : String(err),
            }, isLastAttempt ? 'Database connect retries exhausted' : 'Database connect failed, retrying');
            if (isLastAttempt)
                break;
            await wait(DB_CONNECT_BACKOFF_MS * attempt);
            attempt += 1;
        }
    }
    throw lastError;
}
function isTransientDatabaseStartupError(err) {
    if (!err)
        return false;
    const maybeCode = err.code;
    if (maybeCode === 'P1017') {
        return true;
    }
    const message = err instanceof Error
        ? err.message
        : typeof err === 'string'
            ? err
            : JSON.stringify(err);
    const normalized = message.toLowerCase();
    return (normalized.includes('server has closed the connection') ||
        normalized.includes('connection is closed') ||
        normalized.includes('connection reset') ||
        normalized.includes('forcibly closed by the remote host') ||
        normalized.includes('timeout'));
}
async function runStartupDbOperationWithRetry(operationName, operation) {
    let attempt = 1;
    let lastError;
    while (attempt <= STARTUP_DB_OPERATION_MAX_ATTEMPTS) {
        try {
            return await operation();
        }
        catch (err) {
            lastError = err;
            const transient = isTransientDatabaseStartupError(err);
            const isLastAttempt = attempt === STARTUP_DB_OPERATION_MAX_ATTEMPTS;
            logger.warn({
                operation: operationName,
                attempt,
                maxAttempts: STARTUP_DB_OPERATION_MAX_ATTEMPTS,
                transient,
                error: err instanceof Error
                    ? { name: err.name, message: err.message }
                    : String(err),
            }, transient && !isLastAttempt
                ? 'Startup DB operation failed transiently, retrying'
                : 'Startup DB operation failed');
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
async function ensureSuperAdminAccount() {
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
async function pingWarmupEndpoint() {
    if (!env.BACKEND_WARMUP_URL)
        return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WARMUP_REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(env.BACKEND_WARMUP_URL, {
            method: 'GET',
            headers: { 'user-agent': 'tatvivah-backend-warmup/1.0' },
            signal: controller.signal,
        });
        logger.debug({ status: response.status, url: env.BACKEND_WARMUP_URL }, 'Warmup ping completed');
    }
    catch (err) {
        logger.warn({ err, url: env.BACKEND_WARMUP_URL }, 'Warmup ping failed');
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Start the server
 */
async function bootstrap() {
    try {
        // Verify database connection
        await connectDatabaseWithRetry();
        logger.info('Database connected successfully');
        // Ensure hardcoded super admin always exists in every environment
        await ensureSuperAdminAccount();
        // Create Express app
        const app = createApp();
        // Start server
        const server = app.listen(env.PORT, "0.0.0.0", () => {
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
        const runBackgroundJobs = shouldRunBackgroundJobs();
        let staleOrderTimer = null;
        let integrityTimer = null;
        let reelViewFlushTimer = null;
        let warmupTimer = null;
        let catalogWarmupTimer = null;
        let appointmentSweepTimer = null;
        let fastrrReconcileTimer = null;
        if (runBackgroundJobs) {
            // ---- Stale-order cleanup (runs every 10 min) ----
            staleOrderTimer = setInterval(async () => {
                try {
                    const result = await paymentService.cancelStaleOrders();
                    app.__setLastStaleCleanup(new Date());
                    if (result.cancelled > 0) {
                        logger.info({ cancelled: result.cancelled, total: result.total }, 'Stale order cleanup completed');
                    }
                }
                catch (err) {
                    logger.error({ err }, 'Stale order cleanup error');
                }
            }, withIntervalJitter(STALE_ORDER_INTERVAL_MS));
            // ---- Inventory integrity check (runs every 10 min) ----
            integrityTimer = setInterval(async () => {
                try {
                    const report = await runInventoryIntegrityCheck();
                    app.__setIntegrityReport(report);
                }
                catch (err) {
                    logger.error({ err }, 'Inventory integrity check error');
                }
            }, withIntervalJitter(INTEGRITY_CHECK_INTERVAL_MS));
        }
        let reelFlushInProgress = false;
        const flushReelViews = async (reason) => {
            if (reelFlushInProgress) {
                return;
            }
            reelFlushInProgress = true;
            try {
                const result = await reelRepository.flushReelViews();
                if (result.flushed > 0) {
                    logger.info({ reason, flushed: result.flushed }, 'Buffered reel views flushed');
                }
            }
            catch (err) {
                logger.error({ err, reason }, 'Reel view flush error');
            }
            finally {
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
            // Run both once on startup (after a short delay to let connections settle)
            setTimeout(async () => {
                try {
                    const result = await paymentService.cancelStaleOrders();
                    app.__setLastStaleCleanup(new Date());
                    if (result.cancelled > 0) {
                        logger.info({ cancelled: result.cancelled }, 'Initial stale order cleanup completed');
                    }
                }
                catch (err) {
                    logger.error({ err }, 'Initial stale order cleanup error');
                }
                try {
                    const report = await runInventoryIntegrityCheck();
                    app.__setIntegrityReport(report);
                }
                catch (err) {
                    logger.error({ err }, 'Initial integrity check error');
                }
                await flushReelViews('startup');
                await pingWarmupEndpoint();
                // Refill the storefront cache before real traffic arrives — a deploy
                // empties Redis, and a cold read costs seconds against a remote DB.
                try {
                    await warmCatalogCaches('startup');
                }
                catch (err) {
                    logger.warn({ err }, 'Initial catalog warmup error');
                }
            }, 5000);
            // Keep the storefront cache hot. Entries are also invalidated explicitly
            // on every product mutation, so this only guards against expiry — a
            // shopper should never be the request that refills the cache.
            catalogWarmupTimer = setInterval(() => {
                void warmCatalogCaches('interval').catch((err) => {
                    logger.warn({ err }, 'Catalog warmup error');
                });
            }, withIntervalJitter(CATALOG_WARMUP_INTERVAL_MS));
            appointmentSweepTimer = setInterval(() => {
                void appointmentService.autoCompletePastAppointments().catch((err) => {
                    logger.warn({ err }, 'Appointment completion sweep error');
                });
            }, withIntervalJitter(APPOINTMENT_SWEEP_INTERVAL_MS));
            // ---- Fastrr checkout reconciliation (every 15 min) ----
            // A no-op unless Fastrr is configured.
            fastrrReconcileTimer = setInterval(() => {
                void fastrrOrderService.reconcilePendingSessions().catch((err) => {
                    logger.warn({ err }, 'Fastrr reconciliation error');
                });
            }, withIntervalJitter(FASTRR_RECONCILE_INTERVAL_MS));
        }
        else {
            logger.info({ instance: process.env['NODE_APP_INSTANCE'] }, 'Background jobs disabled on this instance');
        }
        // ------------------------------------------------------------------
        // Graceful shutdown
        // ------------------------------------------------------------------
        const shutdown = async (signal) => {
            if (isShuttingDown)
                return; // prevent re-entry on second SIGINT
            isShuttingDown = true;
            logger.info({ signal }, 'Shutting down gracefully…');
            if (staleOrderTimer)
                clearInterval(staleOrderTimer);
            if (integrityTimer)
                clearInterval(integrityTimer);
            if (reelViewFlushTimer)
                clearInterval(reelViewFlushTimer);
            if (warmupTimer)
                clearInterval(warmupTimer);
            if (catalogWarmupTimer)
                clearInterval(catalogWarmupTimer);
            if (appointmentSweepTimer)
                clearInterval(appointmentSweepTimer);
            if (fastrrReconcileTimer)
                clearInterval(fastrrReconcileTimer);
            server.close(async () => {
                logger.info('HTTP server closed');
                await flushReelViews('shutdown');
                await closeQueueResources().catch(() => { });
                await disconnectDatabase();
                process.exit(0);
            });
            // Force close after 10 seconds
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10_000).unref(); // .unref() so timer alone won't keep process alive
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (error) {
        logger.fatal({ err: error }, 'Failed to start server');
        await closeQueueResources().catch(() => { });
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
//# sourceMappingURL=server.js.map