import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { NotificationJobPayload } from './types.js';
import { resolveRedisUrl } from '../config/redis-url.js';

type NotificationQueueLike = Pick<Queue<NotificationJobPayload>, 'add' | 'close'>;

let redisConnection: Redis | null = null;
let queueInstance: Queue<NotificationJobPayload> | null = null;
let queueDisabled = false;
let disableLogged = false;

function isUpstashQuotaError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const message = String((err as { message?: unknown }).message ?? '').toLowerCase();
    return message.includes('max requests limit exceeded');
}

function disableQueue(reason: string, err?: unknown): void {
    queueDisabled = true;
    if (!disableLogged) {
        disableLogged = true;
        console.warn(`Notification queue disabled: ${reason}`);
        if (err) {
            console.warn(err);
        }
    }

    if (queueInstance) {
        void queueInstance.close().catch(() => {});
        queueInstance = null;
    }

    if (redisConnection) {
        void redisConnection.quit().catch(() => {
            redisConnection?.disconnect();
        });
        redisConnection = null;
    }
}

function getOrCreateRedisConnection(): Redis | null {
    const redisUrl = resolveRedisUrl(env.REDIS_URL);

    if (!redisUrl) {
        return null;
    }
    if (queueDisabled) {
        return null;
    }

    if (!redisConnection) {
        // BullMQ requires a dedicated Redis connection with maxRetriesPerRequest set to null
        redisConnection = new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            connectTimeout: 2000,
            retryStrategy: (times) => {
                if (queueDisabled || times >= 3) return null;
                return Math.min(times * 500, 2000);
            },
            reconnectOnError: (err) => !isUpstashQuotaError(err),
        });

        redisConnection.on('error', (err) => {
            console.error('Redis Queue Connection Error:', err);
            if (isUpstashQuotaError(err)) {
                disableQueue('upstash_max_requests_limit', err);
            }
        });
    }

    return redisConnection;
}

function createNoopQueue(): NotificationQueueLike {
    return {
        add: async () => undefined as any,
        close: async () => undefined,
    };
}

function getOrCreateQueue(): NotificationQueueLike {
    if (queueDisabled) {
        return createNoopQueue();
    }

    if (queueInstance) {
        return queueInstance;
    }

    const connection = getOrCreateRedisConnection();
    if (!connection) {
        console.warn('REDIS_URL is not set. Notifications queue is disabled.');
        return createNoopQueue();
    }

    queueInstance = new Queue<NotificationJobPayload>('notification.queue', {
        connection,
        defaultJobOptions: {
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 5000, // 5s, 10s, 20s...
            },
            removeOnComplete: 1000, // Keep last 1000
            removeOnFail: 5000,    // Keep last 5000 failed
        },
    });

    return queueInstance;
}

export const notificationQueue: NotificationQueueLike = {
    add: async (...args: Parameters<Queue<NotificationJobPayload>['add']>) => {
        const queue = getOrCreateQueue();
        try {
            return await queue.add(...args);
        } catch (err) {
            if (isUpstashQuotaError(err)) {
                disableQueue('upstash_max_requests_limit', err);
                return undefined as any;
            }
            throw err;
        }
    },
    close: async () => {
        if (queueInstance) {
            await queueInstance.close();
            queueInstance = null;
        }
    },
};

export function getQueueRedisConnection(): Redis | null {
    return getOrCreateRedisConnection();
}

export async function closeQueueResources(): Promise<void> {
    if (queueInstance) {
        await queueInstance.close();
        queueInstance = null;
    }

    if (redisConnection) {
        await redisConnection.quit();
        redisConnection = null;
    }
}
