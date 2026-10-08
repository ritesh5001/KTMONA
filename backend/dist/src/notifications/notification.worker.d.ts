import { Job, Worker } from 'bullmq';
import { NotificationJobPayload } from './types.js';
export declare function processNotificationJob(job: Job<NotificationJobPayload>): Promise<void>;
export declare function createNotificationWorker(concurrency?: number): Worker<NotificationJobPayload> | null;
//# sourceMappingURL=notification.worker.d.ts.map