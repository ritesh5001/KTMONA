import { EventEmitter } from 'node:events';
import { Redis as IORedis } from 'ioredis';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { resolveRedisUrl } from '../config/redis-url.js';

export type DashboardEventType =
    | 'product.updated'
    | 'inventory.updated'
    | 'order.updated'
    | 'shipment.updated'
    | 'payment.updated'
    | 'catalog.updated'
    | 'support.message'
    | 'support.ticket.updated';

export interface LiveEventAudience {
    allAuthenticated?: boolean;
    roles?: Role[];
    userIds?: string[];
}

export interface LiveDashboardEvent {
    type: DashboardEventType;
    tags: string[];
    entityId?: string;
    payload?: Record<string, unknown>;
    audience?: LiveEventAudience;
    occurredAt: string;
}

const emitter = new EventEmitter();
const EMIT_EVENT_NAME = 'dashboard-event';

let publisher: IORedis | null = null;
let subscriber: IORedis | null = null;
let redisBacked = false;
let redisDisabledByQuota = false;

function isUpstashQuotaError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const message = String((err as { message?: unknown }).message ?? '').toLowerCase();
    return message.includes('max requests limit exceeded');
}

function handleRedisError(err: unknown): void {
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

function emitLocal(event: LiveDashboardEvent): void {
    emitter.emit(EMIT_EVENT_NAME, event);
}

async function initializeRedisPubSub(): Promise<void> {
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
        subscriber.on('message', (channel: string, message: string) => {
            if (channel !== env.LIVE_EVENTS_CHANNEL) return;
            try {
                const parsed = JSON.parse(message) as LiveDashboardEvent;
                emitLocal(parsed);
            } catch (error) {
                logger.warn({ error }, 'live_event_parse_failed');
            }
        });

        redisBacked = true;
    } catch (error) {
        redisBacked = false;
        publisher = null;
        subscriber = null;
        logger.warn(
            {
                error:
                    error instanceof Error
                        ? { name: error.name, message: error.message }
                        : String(error),
            },
            'live_event_redis_unavailable',
        );
    }
}

void initializeRedisPubSub();

export function onLiveDashboardEvent(listener: (event: LiveDashboardEvent) => void): () => void {
    emitter.on(EMIT_EVENT_NAME, listener);
    return () => {
        emitter.off(EMIT_EVENT_NAME, listener);
    };
}

export async function publishLiveDashboardEvent(input: Omit<LiveDashboardEvent, 'occurredAt'>): Promise<void> {
    const event: LiveDashboardEvent = {
        ...input,
        occurredAt: new Date().toISOString(),
    };

    if (redisBacked && publisher) {
        try {
            await publisher.publish(env.LIVE_EVENTS_CHANNEL, JSON.stringify(event));
            return;
        } catch (error) {
            logger.warn({ error }, 'live_event_publish_failed_fallback_local');
        }
    }

    emitLocal(event);
}
