export const CHECKOUT_CART_SNAPSHOT_KEY = "ktmona_checkout_cart_snapshot";
export const CHECKOUT_CART_SNAPSHOT_TTL_MS = 60_000;
export const CHECKOUT_ADDRESSES_CACHE_KEY = "ktmona_checkout_addresses_cache";
export const CHECKOUT_ADDRESS_CACHE_TTL_MS = 5 * 60_000;

export type CheckoutSnapshotItem = {
  variantId: string;
  quantity: number;
  priceSnapshot: number;
};

export function persistCheckoutCartSnapshot(items: CheckoutSnapshotItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    CHECKOUT_CART_SNAPSHOT_KEY,
    JSON.stringify({
      at: Date.now(),
      items,
    })
  );
}

/**
 * Drop the cached cart snapshot. Call this once an order has been placed — the
 * server-side cart is now empty, and a stale snapshot would otherwise make the
 * checkout page think items still exist (re-enabling "Proceed to Payment" on a
 * Back-navigation and producing a "Cart is empty" 400 on the second submit).
 */
export function clearCheckoutCartSnapshot() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(CHECKOUT_CART_SNAPSHOT_KEY);
}

export function readCheckoutCartSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(CHECKOUT_CART_SNAPSHOT_KEY);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached) as {
      at: number;
      items: CheckoutSnapshotItem[];
    };

    if (
      Date.now() - parsed.at < CHECKOUT_CART_SNAPSHOT_TTL_MS &&
      Array.isArray(parsed.items)
    ) {
      return parsed.items;
    }
  } catch {
    // Ignore malformed cache.
  }

  return null;
}

export function upsertCheckoutSnapshotItem(item: CheckoutSnapshotItem) {
  const existing = readCheckoutCartSnapshot() ?? [];
  const next = existing.filter((entry) => entry.variantId !== item.variantId);
  next.push(item);
  persistCheckoutCartSnapshot(next);
}

/**
 * Drop a single variant from the snapshot. Used to roll back an optimistic
 * add-to-cart when the server rejects it, so the cached view never claims to hold
 * something the real cart does not.
 */
export function removeCheckoutSnapshotItem(variantId: string) {
  const existing = readCheckoutCartSnapshot();
  if (!existing) {
    return;
  }
  persistCheckoutCartSnapshot(
    existing.filter((entry) => entry.variantId !== variantId)
  );
}
