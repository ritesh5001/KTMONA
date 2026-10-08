import pino from 'pino';
/**
 * Structured logger (pino)
 *
 * In production  → JSON output (machine-parsable, compatible with ELK / Datadog / CloudWatch).
 * In development → pretty-printed for human readability.
 *
 * Every domain-specific log event includes:
 *   orderId, userId, variantId, qty, timestamp (automatic via pino).
 */
export declare const logger: pino.Logger<never, boolean>;
export declare const checkoutLogger: pino.Logger<never, boolean>;
export declare const inventoryLogger: pino.Logger<never, boolean>;
export declare const paymentLogger: pino.Logger<never, boolean>;
export declare const integrityLogger: pino.Logger<never, boolean>;
export declare const wishlistLogger: pino.Logger<never, boolean>;
export declare const searchLogger: pino.Logger<never, boolean>;
export declare const adminLogger: pino.Logger<never, boolean>;
export declare const personalizationLogger: pino.Logger<never, boolean>;
export declare const recommendationLogger: pino.Logger<never, boolean>;
export declare const cancellationLogger: pino.Logger<never, boolean>;
export declare const returnLogger: pino.Logger<never, boolean>;
export declare const refundLogger: pino.Logger<never, boolean>;
export declare const commissionLogger: pino.Logger<never, boolean>;
export declare const couponLogger: pino.Logger<never, boolean>;
export declare const orderEventsLogger: pino.Logger<never, boolean>;
export declare const shippingLogger: pino.Logger<never, boolean>;
export declare const notificationLogger: pino.Logger<never, boolean>;
export declare const authLogger: pino.Logger<never, boolean>;
export declare const ordersLogger: pino.Logger<never, boolean>;
export declare const reelLogger: pino.Logger<never, boolean>;
//# sourceMappingURL=logger.d.ts.map