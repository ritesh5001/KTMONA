import { EventEmitter } from 'node:events';
import { Redis as IORedis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { resolveRedisUrl } from '../config/redis-url.js';
const emitter = new EventEmitter();
const EMIT_EVENT_NAME = 'dashboard-event';
let publisher = null;
let subscriber = null;
let redisBacked = false;
let redisDisabledByQuota = false;
function isUpstashQuotaError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const message = String(err.message ?? '').toLowerCase();
    return message.includes('max requests limit exceeded');
}
function handleRedisError(err) {
    if (isUpstashQuotaError(err)) {
        redisDisabledByQuota = true;
        redisBacked = false;
        logger.warn({ error: err }, 'live_event_redis_quota_exceeded');
        publisher?.disconnect(false);
        subscriber?.disconnect(false);
        publisher = null;
        subscriber = null;
    }
}
function emitLocal(event) {
    emitter.emit(EMIT_EVENT_NAME, event);
}
async function initializeRedisPubSub() {
    const redisUrl = resolveRedisUrl(env.REDIS_URL);
    if (!redisUrl || redisBacked || redisDisabledByQuota) {
        return;
    }
    try {
        publisher = new IORedis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            connectTimeout: 2000,
            retryStrategy: (times) => (times >= 2 ? null : Math.min(times * 500, 1000)),
            reconnectOnError: (err) => !isUpstashQuotaError(err),
        });
        subscriber = new IORedis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            connectTimeout: 2000,
            retryStrategy: (times) => (times >= 2 ? null : Math.min(times * 500, 1000)),
            reconnectOnError: (err) => !isUpstashQuotaError(err),
        });
        publisher.on('error', handleRedisError);
        subscriber.on('error', handleRedisError);
        await publisher.connect();
        await subscriber.connect();
        await subscriber.subscribe(env.LIVE_EVENTS_CHANNEL);
        subscriber.on('message', (channel, message) => {
            if (channel !== env.LIVE_EVENTS_CHANNEL)
                return;
            try {
                const parsed = JSON.parse(message);
                emitLocal(parsed);
            }
            catch (error) {
                logger.warn({ error }, 'live_event_parse_failed');
            }
        });
        redisBacked = true;
    }
    catch (error) {
        redisBacked = false;
        publisher = null;
        subscriber = null;
        logger.warn({
            error: error instanceof Error
                ? { name: error.name, message: error.message }
                : String(error),
        }, 'live_event_redis_unavailable');
    }
}
void initializeRedisPubSub();
export function onLiveDashboardEvent(listener) {
    emitter.on(EMIT_EVENT_NAME, listener);
    return () => {
        emitter.off(EMIT_EVENT_NAME, listener);
    };
}
export async function publishLiveDashboardEvent(input) {
    const event = {
        ...input,
        occurredAt: new Date().toISOString(),
    };
    if (redisBacked && publisher) {
        try {
            await publisher.publish(env.LIVE_EVENTS_CHANNEL, JSON.stringify(event));
            return;
        }
        catch (error) {
            logger.warn({ error }, 'live_event_publish_failed_fallback_local');
        }
    }
    emitLocal(event);
}
//# sourceMappingURL=live-events.js.map