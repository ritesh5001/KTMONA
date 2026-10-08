import { CartRepository } from '../repositories/cart.repository.js';
import type { CheckoutResponse } from '../types/order.types.js';
/**
 * Checkout Service
 * Handles the checkout process with atomic inventory reservation.
 *
 * Concurrency strategy:
 *   1. Validate cart items and pricing outside the transaction (read-only).
 *   2. Inside a serialised $transaction:
 *      a. Atomically decrement stock using `updateMany WHERE stock >= qty`.
 *         If ANY row returns count=0 → rollback entire transaction (no partial reservation).
 *      b. Create order + items in the same tx.
 *      c. Create RESERVE movements for audit trail.
 *      d. Clear cart.
 *   3. Cache invalidation + notifications happen outside the tx (best-effort).
 *
 * This guarantees:
 *   - Two users cannot buy the last unit simultaneously.
 *   - Stock can never go negative at the database level.
 *   - No partial reservations — all-or-nothing.
 */
export declare class CheckoutService {
    private readonly cartRepo;
    constructor(cartRepo: CartRepository);
    /**
     * Process checkout — atomic, concurrency-safe
     */
    checkout(userId: string, shipping?: {
        shippingName?: string;
        shippingPhone?: string;
        shippingEmail?: string;
        shippingAddressLine1?: string;
        shippingAddressLine2?: string;
        shippingCity?: string;
        shippingPincode?: string;
        shippingNotes?: string;
    }, couponCode?: string, 
    /**
     * Buy-now: restrict this checkout to these variants. Omitted means the
     * whole cart. Anything not selected stays in the cart untouched.
     */
    variantIds?: string[]): Promise<CheckoutResponse>;
}
export declare const checkoutService: CheckoutService;
//# sourceMappingURL=checkout.service.d.ts.map