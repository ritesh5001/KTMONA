import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { NotificationJobPayload } from './types.js';
type NotificationQueueLike = Pick<Queue<NotificationJobPayload>, 'add' | 'close'>;
export declare const notificationQueue: NotificationQueueLike;
export declare function getQueueRedisConnection(): Redis | null;
export declare function closeQueueResources(): Promise<void>;
export {};
//# sourceMappingURL=notification.queue.d.ts.map