import { Redis as IORedis } from 'ioredis';
import { env } from './env.js';
import { resolveRedisUrl } from './redis-url.js';
const redisUrl = resolveRedisUrl(env.REDIS_URL) || 'redis://127.0.0.1:6379';
function isUpstashQuotaError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const message = String(err.message ?? '').toLowerCase();
    return message.includes('max requests limit exceeded');
}
const redisClient = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy: (times) => {
        if (times >= 2)
            return null;
        return Math.min(times * 500, 1000);
    },
    reconnectOnError: (err) => !isUpstashQuotaError(err),
});
let connectAttempted = false;
let redisAvailable = false;
let redisDisabledByQuota = false;
async function ensureConnected() {
    if (redisDisabledByQuota)
        return false;
    if (redisAvailable)
        return true;
    if (connectAttempted && redisClient.status !== 'ready')
        return false;
    connectAttempted = true;
    try {
        if (redisClient.status !== 'ready') {
            await redisClient.connect();
        }
        redisAvailable = true;
        return true;
    }
    catch {
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
async function safe(fn, fallback) {
    try {
        const connected = await ensureConnected();
        if (!connected)
            return fallback;
        return await fn();
    }
    catch {
        return fallback;
    }
}
export const redis = {
    async ping() {
        return safe(() => redisClient.ping(), null);
    },
    async get(key) {
        const raw = await safe(() => redisClient.get(key), null);
        if (raw == null)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return raw;
        }
    },
    async set(key, value, options) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        if (options?.ex) {
            const ttl = options.ex;
            return safe(() => redisClient.setex(key, ttl, serialized), null);
        }
        return safe(() => redisClient.set(key, serialized), null);
    },
    async del(...keys) {
        if (keys.length === 0)
            return 0;
        return safe(() => redisClient.del(...keys), 0);
    },
    async incr(key) {
        return safe(() => redisClient.incr(key), 0);
    },
    async expire(key, seconds) {
        return safe(() => redisClient.expire(key, seconds), 0);
    },
    async scan(cursor, matchPattern, count = 100) {
        return safe(() => redisClient.scan(cursor, 'MATCH', matchPattern, 'COUNT', count), ['0', []]);
    },
    async zincrby(key, increment, member) {
        return safe(() => redisClient.zincrby(key, increment, member), null);
    },
    async zadd(key, input) {
        return safe(() => redisClient.zadd(key, input.score, input.member), 0);
    },
    async zremrangebyrank(key, start, stop) {
        return safe(() => redisClient.zremrangebyrank(key, start, stop), 0);
    },
    async zrange(key, start, stop, options) {
        const withScores = options?.withScores === true;
        const rev = options?.rev === true;
        const result = rev
            ? await safe(() => (withScores ? redisClient.zrevrange(key, start, stop, 'WITHSCORES') : redisClient.zrevrange(key, start, stop)), [])
            : await safe(() => (withScores ? redisClient.zrange(key, start, stop, 'WITHSCORES') : redisClient.zrange(key, start, stop)), []);
        return result;
    },
    async hincrby(key, field, increment) {
        return safe(() => redisClient.hincrby(key, field, increment), 0);
    },
    async hgetall(key) {
        return safe(() => redisClient.hgetall(key), {});
    },
};
export async function checkRedisConnection() {
    const pong = await redis.ping();
    return pong === 'PONG';
}
//# sourceMappingURL=redis.js.map