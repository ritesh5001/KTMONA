/**
 * Comprehensive Domain Stress Test
 *
 * Validates ALL hardened code paths under concurrent load:
 *   1. Concurrent refunds → over-refund prevention (SELECT FOR UPDATE)
 *   2. Concurrent cancellation requests → P2002 handled gracefully
 *   3. Concurrent wishlist adds → P2002 handled gracefully
 *   4. Concurrent invoice generation → FOR UPDATE prevents duplicate numbers
 *   5. Inventory movement idempotency → reason-discriminated unique constraint
 *
 * Run: npx tsx scripts/stress-test-all-domains.ts
 */
export {};
//# sourceMappingURL=stress-test-all-domains.d.ts.map