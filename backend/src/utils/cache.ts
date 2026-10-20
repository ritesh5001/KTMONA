import { redis } from '../config/redis.js';

type MemoryEntry = {
    value: string;
    expiresAt: number;
};

const memoryCache = new Map<string, MemoryEntry>();

function now(): number {
    return Date.now();
}

function wildcardToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
}

function getMemory(key: string): string | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value;
}

function setMemory(key: string, value: string, ttlSeconds: number): void {
    const expiresAt = now() + Math.max(1, ttlSeconds) * 1000;
    memoryCache.set(key, { value, expiresAt });
}

function deleteMemory(keys: string[]): void {
    for (const key of keys) {
        memoryCache.delete(key);
    }
}

export async function getCache<T = unknown>(key: string): Promise<T | null> {
    // Redis is shared by every server and script; this memory copy is not.
    // When Redis answers, trust it: a miss there means the key was cleared
    // (possibly by another process), so the local copy is stale too. The
    // memory copy is only a fallback for when Redis is unreachable.
    const shared = await redis.tryGet<T>(key);
    if (shared.ok) {
        if (shared.value === null) memoryCache.delete(key);
        return shared.value;
    }

    try {
        const value = getMemory(key);
        if (value == null) return null;
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);

    try {
        await redis.set(key, serialized, { ex: ttlSeconds });
    } catch {
        // Ignore Redis errors and keep API healthy.
    }

    try {
        setMemory(key, serialized, ttlSeconds);
    } catch {
        // Ignore memory cache write errors.
    }
}

export async function deleteCache(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];

    try {
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    } catch {
        // Ignore Redis errors and continue.
    }

    try {
        deleteMemory(keys);
    } catch {
        // Ignore memory cache delete errors.
    }
}

export async function clearCache(pattern: string): Promise<void> {
    try {
        let cursor = '0';

        do {
            const [nextCursor, batchKeys] = await redis.scan(cursor, pattern, 200);
            cursor = nextCursor;
            if (batchKeys.length > 0) {
                await redis.del(...batchKeys);
            }
        } while (cursor !== '0');
    } catch {
        // Ignore Redis errors and still clear memory cache by pattern.
    }

    try {
        const regex = wildcardToRegex(pattern);
        for (const key of memoryCache.keys()) {
            if (regex.test(key)) {
                memoryCache.delete(key);
            }
        }
    } catch {
        // Ignore memory cache clear errors.
    }
}
