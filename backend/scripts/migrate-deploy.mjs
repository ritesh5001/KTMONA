/**
 * Resilient `prisma migrate deploy` wrapper for production boot.
 *
 * Two problems this solves on Render + Neon:
 *
 * 1. Advisory-lock timeouts (P1002). `migrate deploy` takes a session-scoped
 *    Postgres advisory lock, which misbehaves through Neon's PgBouncer pooler.
 *    We force migrations onto the DIRECT (non-pooled) endpoint when available.
 *
 * 2. A previous crashed/overlapping deploy can leave the lock held briefly.
 *    We retry a few times with backoff instead of failing the whole boot on
 *    the first transient P1002.
 *
 * If DATABASE_URL_DIRECT is unset we fall back to DATABASE_URL so the deploy
 * still proceeds (just without the pooler bypass).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// Load .env into process.env if present (Render sets vars directly, but local
// runs and `npm run` do not auto-populate them for a raw node script). We only
// fill values that aren't already set, so real environment vars always win.
if (existsSync('.env')) {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        if (process.env[key] !== undefined) continue;
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
}

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 4000;

// Prefer the direct (non-pooled) URL for migrations. Derive one from the
// pooled URL if only that is set (Neon's direct host drops the "-pooler" part).
function resolveMigrationUrl() {
    const direct = process.env.DATABASE_URL_DIRECT?.trim();
    if (direct) return direct;

    const pooled = process.env.DATABASE_URL?.trim();
    if (pooled && pooled.includes('-pooler')) {
        return pooled.replace('-pooler', '');
    }
    return pooled;
}

const migrationUrl = resolveMigrationUrl();

if (!migrationUrl) {
    console.error('[migrate] No DATABASE_URL / DATABASE_URL_DIRECT set — cannot migrate.');
    process.exit(1);
}

const usingDirect = Boolean(process.env.DATABASE_URL_DIRECT?.trim()) ||
    (process.env.DATABASE_URL ?? '').includes('-pooler');
console.log(`[migrate] Running migrations via ${usingDirect ? 'direct (non-pooled)' : 'configured'} endpoint.`);

function attempt() {
    // Point BOTH url and directUrl at the migration endpoint for this run.
    const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
        stdio: 'inherit',
        env: {
            ...process.env,
            DATABASE_URL: migrationUrl,
            DATABASE_URL_DIRECT: migrationUrl,
        },
    });
    return result.status ?? 1;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const code = attempt();
    if (code === 0) {
        console.log('[migrate] Migrations applied (or already up to date).');
        process.exit(0);
    }

    if (i < MAX_ATTEMPTS) {
        const delay = BASE_DELAY_MS * i;
        console.warn(`[migrate] Attempt ${i} failed (exit ${code}). Retrying in ${delay}ms — likely a held advisory lock from an overlapping deploy.`);
        await sleep(delay);
    } else {
        console.error(`[migrate] All ${MAX_ATTEMPTS} attempts failed. Aborting boot.`);
        process.exit(code);
    }
}
