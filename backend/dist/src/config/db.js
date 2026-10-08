import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
// ---------------------------------------------------------------------------
// BigInt -> JSON
//
// `JSON.stringify` throws outright on a BigInt, so the moment a table gained a
// BIGSERIAL column (the Shiprocket `external_id` surrogates) every code path
// that stringified a whole row started failing — not just `res.json`, but the
// Redis writes underneath it, which is what turned GET /v1/categories into a
// 500 before the response was ever serialised.
//
// Teaching BigInt to serialise itself fixes all of them at once, rather than
// asking every repository that selects a whole row to remember to strip the
// column. Declared here because BigInt only ever enters this app through
// Prisma, so anything holding one has already imported this module.
//
// Number() is safe for these ids: they are sequential surrogates, nowhere near
// the 2^53 limit where precision would start to slip.
// ---------------------------------------------------------------------------
BigInt.prototype.toJSON = function toJSON() {
    return Number(this);
};
// ---------------------------------------------------------------------------
// Global singleton guard — prevents duplicate PrismaClient instances when
// tsx watch-mode (or Next.js HMR) re-executes this module on file change.
// ---------------------------------------------------------------------------
const globalForPrisma = globalThis;
function getIntEnv(name, fallback, min, max) {
    const raw = process.env[name];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed))
        return fallback;
    const n = Math.trunc(parsed);
    if (n < min)
        return min;
    if (n > max)
        return max;
    return n;
}
/**
 * Build the runtime connection URL.
 *
 * Prefers DATABASE_URL_DIRECT (Neon's non-pooled endpoint) when it is set.
 *
 * This looks backwards — a web server "should" go through PgBouncer — but it was
 * measured against this Neon project on 2026-07-30 and the pooler is drastically
 * slower here:
 *
 *              SELECT 1     findMany(20)   12 concurrent
 *   pooled       1623ms         2652ms          6511ms
 *   direct        275ms          287ms          3655ms
 *
 * Roughly 9x worse on single-query latency and still worse under concurrency.
 * Prisma also disables prepared-statement reuse when `pgbouncer=true`, so every
 * query re-parses. Concurrency is instead handled by a larger direct pool, which
 * measured 808ms -> 538ms -> 307ms for 12 parallel queries at limits 5, 10 and 20.
 *
 * If you are tempted to "fix" this by switching to the pooled URL, re-run that
 * benchmark first. The pooler is still required for migrations (advisory locks are
 * session-scoped), which is handled separately by schema.prisma's `directUrl` and
 * scripts/migrate-deploy.mjs.
 */
function buildPrismaDatabaseUrl(rawUrl, directUrl) {
    try {
        const parsed = new URL(directUrl ? directUrl : rawUrl);
        const isPooledHost = parsed.hostname.includes('-pooler.');
        const pooledConnectionLimit = getIntEnv('DB_POOL_CONNECTION_LIMIT', 10, 1, 100);
        const pooledPoolTimeout = getIntEnv('DB_POOL_TIMEOUT', 15, 1, 120);
        // 20, not 5: measured 12 concurrent queries at 808ms (limit 5), 538ms (10),
        // 307ms (20). A checkout holds a connection for its whole transaction, so a
        // small pool makes concurrent orders queue behind each other.
        const directConnectionLimit = getIntEnv('DB_DIRECT_CONNECTION_LIMIT', 20, 1, 100);
        if (isPooledHost) {
            parsed.searchParams.set('pgbouncer', 'true');
            parsed.searchParams.set('connection_limit', String(pooledConnectionLimit));
            parsed.searchParams.set('pool_timeout', String(pooledPoolTimeout));
        }
        // Direct endpoint: set the pool size measured above.
        if (!isPooledHost && !parsed.searchParams.has('connection_limit')) {
            parsed.searchParams.set('connection_limit', String(directConnectionLimit));
        }
        return parsed.toString();
    }
    catch {
        return rawUrl;
    }
}
function createPrismaClient() {
    const url = buildPrismaDatabaseUrl(env.DATABASE_URL, env.DATABASE_URL_DIRECT);
    // Log which endpoint we actually dialled (never the credentials). Running the
    // web server against the unpooled endpoint is a silent, hard-to-spot
    // performance regression, so make it visible at boot.
    try {
        const parsed = new URL(url);
        console.log(`[db] host=${parsed.hostname} pooled=${parsed.hostname.includes('-pooler.')} ` +
            `connection_limit=${parsed.searchParams.get('connection_limit') ?? 'default'}`);
    }
    catch {
        // Never let logging break startup.
    }
    const client = new PrismaClient({
        datasources: { db: { url } },
        log: env.NODE_ENV === 'development' && env.PRISMA_LOG_QUERIES
            ? [{ emit: 'stdout', level: 'query' }]
            : [],
    });
    return client;
}
/**
 * Singleton PrismaClient instance used across the entire backend.
 * In non-production environments it is pinned to globalThis so tsx
 * watch-mode restarts reuse the same connection pool.
 */
export const prisma = globalForPrisma.__prisma ?? createPrismaClient();
if (env.NODE_ENV !== 'production') {
    globalForPrisma.__prisma = prisma;
}
// ---------------------------------------------------------------------------
// Neon idle-timeout safety
// Neon serverless Postgres closes idle connections after ~5 min. Prisma's
// query engine reconnects automatically on the next query, but the internal
// error event fires first. We swallow it so it doesn't pollute logs or
// trigger uncaught-error handlers.
// ---------------------------------------------------------------------------
// @ts-expect-error — Prisma's $on('error') is loosely typed at runtime
prisma.$on('error', (e) => {
    if (e.message?.includes('Closed') ||
        e.message?.includes("Can't reach database server")) {
        // Intentionally silent — Prisma reconnects automatically
        return;
    }
    // All other Prisma-level errors still surface
    console.error('[prisma] internal error:', e);
});
// ---------------------------------------------------------------------------
// Lifecycle helpers (called from server.ts)
// ---------------------------------------------------------------------------
/**
 * Graceful shutdown handler for Prisma connection.
 * Safe to call multiple times (Prisma ignores repeat disconnects).
 */
export async function disconnectDatabase() {
    try {
        await prisma.$disconnect();
    }
    catch {
        // Swallow — connection may already be closed during forced shutdown
    }
}
/**
 * Health check for database connection
 */
export async function checkDatabaseConnection() {
    try {
        await prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=db.js.map