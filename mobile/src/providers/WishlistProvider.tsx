import * as React from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "./ToastProvider";
import { useWishlistStore } from "../stores/wishlistStore";
import type { WishlistItemDetail } from "../services/wishlist";

interface WishlistContextValue {
  wishlistItems: WishlistItemDetail[];
  wishlistedIds: ReadonlySet<string>;
  wishlistCount: number;
  isLoading: boolean;
  isMutating: boolean;
  mutatingIds: ReadonlySet<string>;
  refreshWishlist: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  fetchError: string | null;
}

const WishlistContext = React.createContext<WishlistContextValue>({
  wishlistItems: [],
  wishlistedIds: new Set(),
  wishlistCount: 0,
  isLoading: true,
  isMutating: false,
  mutatingIds: new Set(),
  refreshWishlist: async () => {},
  toggleWishlist: async () => {},
  removeFromWishlist: async () => {},
  isWishlisted: () => false,
  fetchError: null,
});

export function useWishlist() {
  return React.useContext(WishlistContext);
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const token = session?.accessToken ?? null;
  const { showToast } = useToast();

  const {
    wishlistItems,
    isLoading,
    fetchError,
    mutatingIds,
    setToken,
    refreshWishlist,
    toggleWishlist,
    removeFromWishlist,
    bindAppState,
  } = useWishlistStore();

  React.useEffect(() => {
    setToken(token);
  }, [token, setToken]);

  React.useEffect(() => {
    if (!token) return undefined;
    return bindAppState();
  }, [token, bindAppState]);

  const toggleWishlistSafe = React.useCallback(
    async (productId: string) => {
      try {
        await toggleWishlist(productId);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to update wishlist",
          "error"
        );
      }
    },
    [toggleWishlist, showToast]
  );

  const removeFromWishlistSafe = React.useCallback(
    async (productId: string) => {
      try {
        await removeFromWishlist(productId);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to remove from wishlist",
          "error"
        );
      }
    },
    [removeFromWishlist, showToast]
  );

  const wishlistedIds = React.useMemo(
    () => new Set(wishlistItems.map((item) => item.productId)),
    [wishlistItems]
  );

  const isWishlisted = React.useCallback(
    (productId: string) => wishlistedIds.has(productId),
    [wishlistedIds]
  );

  const value = React.useMemo(
    () => ({
      wishlistItems,
      wishlistedIds,
      wishlistCount: wishlistItems.length,
      isLoading,
      isMutating: mutatingIds.size > 0,
      mutatingIds,
      refreshWishlist,
      toggleWishlist: toggleWishlistSafe,
      removeFromWishlist: removeFromWishlistSafe,
      isWishlisted,
      fetchError,
    }),
    [
      wishlistItems,
      wishlistedIds,
      isLoading,
      mutatingIds,
      refreshWishlist,
      toggleWishlistSafe,
      removeFromWishlistSafe,
      isWishlisted,
      fetchError,
    ]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
