import { redis } from '../config/redis.js';
const memoryCache = new Map();
function now() {
    return Date.now();
}
function wildcardToRegex(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
}
function getMemory(key) {
    const entry = memoryCache.get(key);
    if (!entry)
        return null;
    if (entry.expiresAt <= now()) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value;
}
function setMemory(key, value, ttlSeconds) {
    const expiresAt = now() + Math.max(1, ttlSeconds) * 1000;
    memoryCache.set(key, { value, expiresAt });
}
function deleteMemory(keys) {
    for (const key of keys) {
        memoryCache.delete(key);
    }
}
export async function getCache(key) {
    try {
        const value = await redis.get(key);
        if (value !== null) {
            return value;
        }
    }
    catch {
        // Ignore Redis errors and fallback to memory cache.
    }
    try {
        const value = getMemory(key);
        if (value == null)
            return null;
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
export async function setCache(key, value, ttlSeconds) {
    const serialized = JSON.stringify(value);
    try {
        await redis.set(key, serialized, { ex: ttlSeconds });
    }
    catch {
        // Ignore Redis errors and keep API healthy.
    }
    try {
        setMemory(key, serialized, ttlSeconds);
    }
    catch {
        // Ignore memory cache write errors.
    }
}
export async function deleteCache(key) {
    const keys = Array.isArray(key) ? key : [key];
    try {
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    }
    catch {
        // Ignore Redis errors and continue.
    }
    try {
        deleteMemory(keys);
    }
    catch {
        // Ignore memory cache delete errors.
    }
}
export async function clearCache(pattern) {
    try {
        let cursor = '0';
        do {
            const [nextCursor, batchKeys] = await redis.scan(cursor, pattern, 200);
            cursor = nextCursor;
            if (batchKeys.length > 0) {
                await redis.del(...batchKeys);
            }
        } while (cursor !== '0');
    }
    catch {
        // Ignore Redis errors and still clear memory cache by pattern.
    }
    try {
        const regex = wildcardToRegex(pattern);
        for (const key of memoryCache.keys()) {
            if (regex.test(key)) {
                memoryCache.delete(key);
            }
        }
    }
    catch {
        // Ignore memory cache clear errors.
    }
}
//# sourceMappingURL=cache.js.map