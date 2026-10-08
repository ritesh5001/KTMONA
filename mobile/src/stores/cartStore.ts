import { AppState, type AppStateStatus } from "react-native";
import { create } from "zustand";
import { getAccessToken } from "../storage/auth";
import {
  getCart,
  addCartItem as apiAddCartItem,
  updateCartItem as apiUpdateCartItem,
  removeCartItem as apiRemoveCartItem,
  type AddCartItemPayload,
  type CartItemDetails,
} from "../services/cart";

interface CartState {
  token: string | null;
  cartItems: CartItemDetails[];
  isLoading: boolean;
  fetchError: string | null;
  mutatingIds: ReadonlySet<string>;
  setToken: (token: string | null) => void;
  refreshCart: () => Promise<void>;
  addToCart: (payload: AddCartItemPayload) => Promise<void>;
  updateQuantity: (itemId: string, nextQty: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => void;
  bindAppState: () => () => void;
}

const mutationLocks = new Set<string>();

/**
 * Pending quantity writes, coalesced per cart item.
 *
 * Tapping + three times used to fire three PATCHes and disable the stepper for a
 * round trip each time — on a cold backend that is seconds of a dead button. The
 * quantity is applied to the UI immediately and only the final value is sent.
 */
const QUANTITY_WRITE_DEBOUNCE_MS = 450;
const pendingQuantityTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelPendingQuantityWrite(itemId: string): void {
  const timer = pendingQuantityTimers.get(itemId);
  if (timer) {
    clearTimeout(timer);
    pendingQuantityTimers.delete(itemId);
  }
}

function lockItem(id: string, set: (fn: (state: CartState) => CartState) => void): boolean {
  if (mutationLocks.has(id)) return false;
  mutationLocks.add(id);
  set((state) => ({
    ...state,
    mutatingIds: new Set(state.mutatingIds).add(id),
  }));
  return true;
}

function unlockItem(id: string, set: (fn: (state: CartState) => CartState) => void): void {
  mutationLocks.delete(id);
  set((state) => {
    const next = new Set(state.mutatingIds);
    next.delete(id);
    return { ...state, mutatingIds: next };
  });
}

async function resolveToken(explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  return getAccessToken();
}

export const useCartStore = create<CartState>((set, get) => ({
  token: null,
  cartItems: [],
  isLoading: false,
  fetchError: null,
  mutatingIds: new Set(),

  setToken: (token) => {
    if (!token) {
      mutationLocks.clear();
      set({ token: null, cartItems: [], isLoading: false, fetchError: null, mutatingIds: new Set() });
      return;
    }
    set((state) => ({ ...state, token }));
    get().refreshCart();
  },

  refreshCart: async () => {
    const token = await resolveToken(get().token);
    if (!token) return;
    set((state) => ({ ...state, isLoading: true, fetchError: null }));
    try {
      const result = await getCart(token);
      set((state) => ({ ...state, cartItems: result.cart.items ?? [] }));
    } catch (err) {
      set((state) => ({
        ...state,
        fetchError: err instanceof Error ? err.message : "Failed to load cart",
      }));
    } finally {
      set((state) => ({ ...state, isLoading: false }));
    }
  },

  addToCart: async (payload) => {
    const token = await resolveToken(get().token);
    if (!token) return;
    const tempKey = `add_${payload.productId}_${payload.variantId}`;
    if (!lockItem(tempKey, set)) return;
    const snapshot = [...get().cartItems];
    const existing = snapshot.find(
      (item) =>
        item.productId === payload.productId &&
        item.variantId === payload.variantId
    );

    const optimisticId = existing?.id ?? `temp_${Date.now()}`;
    set((state) => ({
      ...state,
      cartItems: existing
        ? state.cartItems.map((item) =>
            item.id === existing.id
              ? { ...item, quantity: item.quantity + payload.quantity }
              : item
          )
        : [
            {
              id: optimisticId,
              productId: payload.productId,
              variantId: payload.variantId,
              quantity: payload.quantity,
              // Seeded from what the caller already had on screen, so the row is
              // complete from the first frame instead of "Item / ₹0".
              priceSnapshot: payload.preview?.price ?? 0,
              product: payload.preview
                ? {
                    id: payload.productId,
                    title: payload.preview.title ?? "Item",
                    sellerId: "",
                    images: payload.preview.image ? [payload.preview.image] : [],
                  }
                : undefined,
              variant: payload.preview
                ? {
                    id: payload.variantId,
                    size: payload.preview.size ?? "Default",
                    sku: "",
                    color: payload.preview.color ?? null,
                    colorHex: payload.preview.colorHex ?? null,
                    images: payload.preview.image ? [payload.preview.image] : [],
                    price: payload.preview.price ?? 0,
                    compareAtPrice: payload.preview.compareAtPrice ?? null,
                    inventory: null,
                  }
                : undefined,
            },
            ...state.cartItems,
          ],
    }));

    try {
      const result = await apiAddCartItem(payload, token);
      set((state) => ({
        ...state,
        cartItems: state.cartItems.map((item) =>
          item.id === optimisticId
            ? {
                ...item,
                id: result.item.id,
                quantity: result.item.quantity,
                priceSnapshot: result.item.priceSnapshot,
              }
            : item
        ),
      }));
      get().refreshCart();
    } catch (err) {
      set((state) => ({ ...state, cartItems: snapshot }));
      throw err;
    } finally {
      unlockItem(tempKey, set);
    }
  },

  updateQuantity: async (itemId, nextQty) => {
    const token = await resolveToken(get().token);
    if (!token) return;

    if (nextQty <= 0) {
      cancelPendingQuantityWrite(itemId);
      return get().removeFromCart(itemId);
    }

    const snapshot = [...get().cartItems];

    // Apply straight away and leave the stepper enabled — the shopper should be
    // able to tap + repeatedly without waiting on the network between taps.
    set((state) => ({
      ...state,
      cartItems: state.cartItems.map((item) =>
        item.id === itemId ? { ...item, quantity: nextQty } : item
      ),
    }));

    cancelPendingQuantityWrite(itemId);
    pendingQuantityTimers.set(
      itemId,
      setTimeout(async () => {
        pendingQuantityTimers.delete(itemId);
        // Send whatever the quantity settled on, not the value from the tap that
        // happened to start this timer.
        const settled = get().cartItems.find((item) => item.id === itemId)?.quantity;
        if (!settled || settled <= 0) return;

        try {
          await apiUpdateCartItem(itemId, settled, token);
          get().refreshCart();
        } catch {
          // Roll the row back to what the server last confirmed.
          set((state) => ({ ...state, cartItems: snapshot }));
        }
      }, QUANTITY_WRITE_DEBOUNCE_MS)
    );
  },

  removeFromCart: async (itemId) => {
    const token = await resolveToken(get().token);
    if (!token) return;
    cancelPendingQuantityWrite(itemId);
    if (!lockItem(itemId, set)) return;

    const snapshot = [...get().cartItems];
    set((state) => ({
      ...state,
      cartItems: state.cartItems.filter((item) => item.id !== itemId),
    }));

    try {
      await apiRemoveCartItem(itemId, token);
      get().refreshCart();
    } catch (err) {
      set((state) => ({ ...state, cartItems: snapshot }));
      throw err;
    } finally {
      unlockItem(itemId, set);
    }
  },

  clearCart: () => {
    mutationLocks.clear();
    set((state) => ({ ...state, cartItems: [], mutatingIds: new Set() }));
  },

  bindAppState: () => {
    const handler = (state: AppStateStatus) => {
      if (state === "active") get().refreshCart();
    };
    const subscription = AppState.addEventListener("change", handler);
    return () => subscription.remove();
  },
}));
