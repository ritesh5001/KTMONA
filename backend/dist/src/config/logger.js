import pino from 'pino';
import { env } from './env.js';
/**
 * Structured logger (pino)
 *
 * In production  → JSON output (machine-parsable, compatible with ELK / Datadog / CloudWatch).
 * In development → pretty-printed for human readability.
 *
 * Every domain-specific log event includes:
 *   orderId, userId, variantId, qty, timestamp (automatic via pino).
 */
export const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    ...(env.NODE_ENV !== 'production' && {
        transport: {
            target: 'pino/file',
            options: { destination: 1 }, // stdout
        },
    }),
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    base: { service: 'tatvivah-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
});
// ─── Domain-specific child loggers ──────────────────────────────────
export const checkoutLogger = logger.child({ module: 'checkout' });
export const inventoryLogger = logger.child({ module: 'inventory' });
export const paymentLogger = logger.child({ module: 'payment' });
export const integrityLogger = logger.child({ module: 'integrity' });
export const wishlistLogger = logger.child({ module: 'wishlist' });
export const searchLogger = logger.child({ module: 'search' });
export const adminLogger = logger.child({ module: 'admin' });
export const personalizationLogger = logger.child({ module: 'personalization' });
export const recommendationLogger = logger.child({ module: 'recommendation' });
export const cancellationLogger = logger.child({ module: 'cancellation' });
export const returnLogger = logger.child({ module: 'return' });
export const refundLogger = logger.child({ module: 'refund' });
export const commissionLogger = logger.child({ module: 'commission' });
export const couponLogger = logger.child({ module: 'coupon' });
export const orderEventsLogger = logger.child({ module: 'order-events' });
export const shippingLogger = logger.child({ module: 'shipping' });
export const notificationLogger = logger.child({ module: 'notifications' });
export const authLogger = logger.child({ module: 'auth' });
export const ordersLogger = logger.child({ module: 'orders' });
export const reelLogger = logger.child({ module: 'reels' });
//# sourceMappingURL=logger.js.map