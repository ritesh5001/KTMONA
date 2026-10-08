/**
 * Concurrent Checkout Load Simulation
 *
 * Proves inventory hard-locking works under high concurrency:
 *   1. Creates a product with a single variant (stock = STOCK_LIMIT).
 *   2. Creates CONCURRENT_USERS unique buyer accounts, each with the item in cart.
 *   3. Fires all CONCURRENT_USERS checkouts simultaneously via Promise.allSettled.
 *   4. Asserts:
 *        - Exactly STOCK_LIMIT succeed (HTTP 201).
 *        - Remaining fail with 409 (out of stock).
 *        - Final DB stock === 0 (never negative).
 *        - InventoryMovements of type RESERVE === STOCK_LIMIT.
 *
 * Usage:  npx tsx scripts/simulate-checkout.ts
 * Requires: backend server running on PORT (default 4000)
 */
export {};
//# sourceMappingURL=simulate-checkout.d.ts.map