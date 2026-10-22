/**
 * Cart for shoppers who are not signed in (guest checkout).
 *
 * Kept in localStorage with a small display snapshot (title, image, price) so the
 * cart renders without an account. At checkout the guest verifies their email
 * with a one-time code; the lines are then merged into their server cart and
 * this copy is cleared. Prices shown here are estimates — checkout re-prices
 * everything on the server.
 */

export interface GuestCartLine {
  productId: string;
  variantId: string;
  quantity: number;
  title: string;
  image: string | null;
  price: number | null;
  mrp: number | null;
  size: string | null;
  color: string | null;
  addedAt: number;
}

const KEY = "ktmona.guestCart";
const EVENT = "ktmona:guest-cart";
const MAX_LINES = 50;

export function readGuestCart(): GuestCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as GuestCartLine[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(lines: GuestCartLine[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines.slice(0, MAX_LINES)));
  } catch {
    // Private mode / storage full: the cart just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Add a line, or bump its quantity if that size/colour is already there. */
export function addGuestCartLine(line: Omit<GuestCartLine, "addedAt" | "quantity"> & { quantity?: number }) {
  const lines = readGuestCart();
  const existing = lines.find((l) => l.variantId === line.variantId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + (line.quantity ?? 1), 10);
    write(lines);
    return;
  }
  write([{ ...line, quantity: line.quantity ?? 1, addedAt: Date.now() }, ...lines]);
}

export function setGuestCartQuantity(variantId: string, quantity: number) {
  const lines = readGuestCart();
  write(
    quantity <= 0
      ? lines.filter((l) => l.variantId !== variantId)
      : lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, 10) } : l))
  );
}

export function removeGuestCartLine(variantId: string) {
  write(readGuestCart().filter((l) => l.variantId !== variantId));
}

export function clearGuestCart() {
  write([]);
}

/** Re-render on any change (this tab or another). */
export function subscribeGuestCart(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}
