/**
 * Order Event Dispatchers
 *
 * Centralized event-driven notification dispatching.
 * All order-lifecycle notifications are triggered through these functions.
 *
 * KEY DESIGN DECISIONS:
 * 1. Every function is wrapped in try/catch — notification failure NEVER crashes
 *    the calling service (best-effort delivery).
 * 2. eventKey-based idempotency on every call — safe for double-fire from both
 *    checkout and webhook.
 * 3. Each emitter fetches its own context (order, items, seller) from DB so
 *    callers only pass orderId.
 */
export declare function emitOrderPlaced(orderId: string): Promise<void>;
export declare function emitPaymentSuccess(orderId: string): Promise<void>;
export declare function emitPaymentFailed(orderId: string): Promise<void>;
export declare function emitShipmentShipped(orderId: string, carrier: string, trackingNumber: string): Promise<void>;
export declare function emitShipmentCreated(orderId: string, carrier: string, trackingNumber: string): Promise<void>;
export declare function emitShipmentDelivered(orderId: string): Promise<void>;
//# sourceMappingURL=order.events.d.ts.map