import { Redis as IORedis } from 'ioredis';
import { env } from './env.js';
import { resolveRedisUrl } from './redis-url.js';

type ZRangeOptions = {
    rev?: boolean;
    withScores?: boolean;
};

const redisUrl = resolveRedisUrl(env.REDIS_URL) || 'redis://127.0.0.1:6379';

function isUpstashQuotaError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const message = String((err as { message?: unknown }).message ?? '').toLowerCase();
    return message.includes('max requests limit exceeded');
}

const redisClient = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy: (times) => {
        if (times >= 2) return null;
        return Math.min(times * 500, 1000);
    },
    reconnectOnError: (err) => !isUpstashQuotaError(err),
});

let connectAttempted = false;
let redisAvailable = false;
let redisDisabledByQuota = false;

async function ensureConnected(): Promise<boolean> {
    if (redisDisabledByQuota) return false;
    if (redisAvailable) return true;
    if (connectAttempted && redisClient.status !== 'ready') return false;

    connectAttempted = true;
    try {
        if (redisClient.status !== 'ready') {
            await redisClient.connect();
        }
        redisAvailable = true;
        return true;
    } catch {
        redisAvailable = false;
        return false;
    }
}

redisClient.on('error', (err) => {
    redisAvailable = false;
    if (isUpstashQuotaError(err)) {
        redisDisabledByQuota = true;
        redisClient.disconnect(false);
    }
});

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        const connected = await ensureConnected();
        if (!connected) return fallback;
        return await fn();
    } catch {
        return fallback;
    }
}

export const redis = {
    async ping(): Promise<string | null> {
        return safe(() => redisClient.ping(), null);
    },

    async get<T = unknown>(key: string): Promise<T | null> {
        const raw = await safe(() => redisClient.get(key), null as string | null);
        if (raw == null) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return raw as unknown as T;
        }
    },

    async set(key: string, value: unknown, options?: { ex?: number }): Promise<'OK' | null> {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        if (options?.ex) {
            const ttl = options.ex;
            return safe(() => redisClient.setex(key, ttl, serialized), null);
        }
        return safe(() => redisClient.set(key, serialized), null);
    },

    async del(...keys: string[]): Promise<number> {
        if (keys.length === 0) return 0;
        return safe(() => redisClient.del(...keys), 0);
    },

    async incr(key: string): Promise<number> {
        return safe(() => redisClient.incr(key), 0);
    },

    async expire(key: string, seconds: number): Promise<number> {
        return safe(() => redisClient.expire(key, seconds), 0);
    },

    async scan(cursor: string, matchPattern: string, count = 100): Promise<[string, string[]]> {
        return safe(() => redisClient.scan(cursor, 'MATCH', matchPattern, 'COUNT', count), ['0', []]);
    },

    async zincrby(key: string, increment: number, member: string): Promise<string | null> {
        return safe(() => redisClient.zincrby(key, increment, member), null);
    },

    async zadd(key: string, input: { score: number; member: string }): Promise<number> {
        return safe(() => redisClient.zadd(key, input.score, input.member), 0);
    },

    async zremrangebyrank(key: string, start: number, stop: number): Promise<number> {
        return safe(() => redisClient.zremrangebyrank(key, start, stop), 0);
    },

    async zrange<T = string[]>(
        key: string,
        start: number,
        stop: number,
        options?: ZRangeOptions,
    ): Promise<T> {
        const withScores = options?.withScores === true;
        const rev = options?.rev === true;

        const result = rev
            ? await safe(
                () => (withScores ? redisClient.zrevrange(key, start, stop, 'WITHSCORES') : redisClient.zrevrange(key, start, stop)),
                [] as string[],
            )
            : await safe(
                () => (withScores ? redisClient.zrange(key, start, stop, 'WITHSCORES') : redisClient.zrange(key, start, stop)),
                [] as string[],
            );

        return result as unknown as T;
    },

    async hincrby(key: string, field: string, increment: number): Promise<number> {
        return safe(() => redisClient.hincrby(key, field, increment), 0);
    },

    async hgetall(key: string): Promise<Record<string, string>> {
        return safe(() => redisClient.hgetall(key), {} as Record<string, string>);
    },
};

export async function checkRedisConnection(): Promise<boolean> {
    const pong = await redis.ping();
    return pong === 'PONG';
}
