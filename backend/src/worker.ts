import { env } from './config/env.js';
import { prisma } from './config/db.js';
import { closeQueueResources } from './notifications/notification.queue.js';
import { createNotificationWorker } from './notifications/notification.worker.js';

if (!env.REDIS_URL) {
    console.warn('REDIS_URL is not set. Worker process started with notifications disabled.');
}

const notificationWorker = createNotificationWorker(5);

if (notificationWorker) {
    console.log('Notification worker started in dedicated process');
}

let shuttingDown = false;

const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log('Worker process shutdown initiated');

    try {
        if (notificationWorker) {
            await notificationWorker.close();
        }
        await closeQueueResources();
        await prisma.$disconnect();
        console.log('Worker process shutdown completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error during worker shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
