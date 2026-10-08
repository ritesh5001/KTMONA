import * as React from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "./ToastProvider";
import { useCartStore } from "../stores/cartStore";
import type { AddCartItemPayload, CartItemDetails } from "../services/cart";

interface CartContextValue {
  cartItems: CartItemDetails[];
  cartCount: number;
  isLoading: boolean;
  isMutating: boolean;
  mutatingIds: ReadonlySet<string>;
  refreshCart: () => Promise<void>;
  addToCart: (payload: AddCartItemPayload) => Promise<void>;
  updateQuantity: (itemId: string, nextQty: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => void;
  fetchError: string | null;
}

const CartContext = React.createContext<CartContextValue>({
  cartItems: [],
  cartCount: 0,
  isLoading: true,
  isMutating: false,
  mutatingIds: new Set(),
  refreshCart: async () => {},
  addToCart: async () => {},
  updateQuantity: async () => {},
  removeFromCart: async () => {},
  clearCart: () => {},
  fetchError: null,
});

export function useCart() {
  return React.useContext(CartContext);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const token = session?.accessToken ?? null;
  const { showToast } = useToast();

  const {
    cartItems,
    isLoading,
    fetchError,
    mutatingIds,
    setToken,
    refreshCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    bindAppState,
  } = useCartStore();

  React.useEffect(() => {
    setToken(token);
  }, [token, setToken]);

  React.useEffect(() => {
    if (!token) return undefined;
    return bindAppState();
  }, [token, bindAppState]);

  const addToCartSafe = React.useCallback(
    async (payload: AddCartItemPayload) => {
      try {
        await addToCart(payload);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to add item",
          "error"
        );
        throw err;
      }
    },
    [addToCart, showToast]
  );

  const updateQuantitySafe = React.useCallback(
    async (itemId: string, nextQty: number) => {
      try {
        await updateQuantity(itemId, nextQty);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to update quantity",
          "error"
        );
      }
    },
    [updateQuantity, showToast]
  );

  const removeFromCartSafe = React.useCallback(
    async (itemId: string) => {
      try {
        await removeFromCart(itemId);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to remove item",
          "error"
        );
      }
    },
    [removeFromCart, showToast]
  );

  const cartCount = React.useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const value = React.useMemo(
    () => ({
      cartItems,
      cartCount,
      isLoading,
      isMutating: mutatingIds.size > 0,
      mutatingIds,
      refreshCart,
      addToCart: addToCartSafe,
      updateQuantity: updateQuantitySafe,
      removeFromCart: removeFromCartSafe,
      clearCart,
      fetchError,
    }),
    [
      cartItems,
      cartCount,
      isLoading,
      mutatingIds,
      refreshCart,
      addToCartSafe,
      updateQuantitySafe,
      removeFromCartSafe,
      clearCart,
      fetchError,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
