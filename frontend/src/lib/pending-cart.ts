/**
 * Hand-off for a cart write that is still in flight across a client-side navigation.
 *
 * "Buy Now" used to await the add-to-cart round-trip before calling router.push, so
 * the buyer stared at the product page for the whole request before anything moved.
 * Now the navigation happens immediately and the request keeps running; because
 * router.push is a client-side transition, this module's state survives it and the
 * checkout page can wait for the write at the two points where it actually matters:
 *
 *   - before reading the cart, so it doesn't render "empty" and overwrite the
 *     optimistic snapshot
 *   - before placing the order, so the server cart is guaranteed to contain the item
 *
 * That keeps the page instant without introducing a race where Place Order beats the
 * add-to-cart and fails with "Cart is empty".
 */

let pendingWrite: Promise<void> | null = null;

/** Register an in-flight cart mutation. Replaces any previous one. */
export function trackPendingCartWrite(promise: Promise<unknown>): void {
  const tracked = promise.then(
    () => undefined,
    (error: unknown) => {
      throw error instanceof Error ? error : new Error(String(error));
    }
  );

  pendingWrite = tracked;

  // Attach our own handler so a rejection nobody awaited never surfaces as an
  // unhandled promise rejection, and clear the slot once it settles.
  void tracked
    .catch(() => undefined)
    .finally(() => {
      if (pendingWrite === tracked) {
        pendingWrite = null;
      }
    });
}

/**
 * Resolve once any in-flight cart write has finished.
 * Rethrows the original error so the caller can surface it.
 */
export async function flushPendingCartWrite(): Promise<void> {
  const current = pendingWrite;
  if (!current) return;
  await current;
}
