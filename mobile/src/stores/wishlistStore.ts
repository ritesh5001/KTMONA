import { AppState, type AppStateStatus } from "react-native";
import { create } from "zustand";
import { getAccessToken } from "../storage/auth";
import {
  getWishlist,
  toggleWishlistItem as apiToggle,
  removeWishlistItem as apiRemove,
  type WishlistItemDetail,
} from "../services/wishlist";

interface WishlistState {
  token: string | null;
  wishlistItems: WishlistItemDetail[];
  isLoading: boolean;
  fetchError: string | null;
  mutatingIds: ReadonlySet<string>;
  setToken: (token: string | null) => void;
  refreshWishlist: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  bindAppState: () => () => void;
}

const mutationLocks = new Set<string>();

function lockItem(id: string, set: (fn: (state: WishlistState) => WishlistState) => void): boolean {
  if (mutationLocks.has(id)) return false;
  mutationLocks.add(id);
  set((state) => ({
    ...state,
    mutatingIds: new Set(state.mutatingIds).add(id),
  }));
  return true;
}

function unlockItem(id: string, set: (fn: (state: WishlistState) => WishlistState) => void): void {
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

export const useWishlistStore = create<WishlistState>((set, get) => ({
  token: null,
  wishlistItems: [],
  isLoading: false,
  fetchError: null,
  mutatingIds: new Set(),

  setToken: (token) => {
    if (!token) {
      mutationLocks.clear();
      set({ token: null, wishlistItems: [], isLoading: false, fetchError: null, mutatingIds: new Set() });
      return;
    }
    set((state) => ({ ...state, token }));
    get().refreshWishlist();
  },

  refreshWishlist: async () => {
    const token = await resolveToken(get().token);
    if (!token) return;
    set((state) => ({ ...state, isLoading: true, fetchError: null }));
    try {
      const result = await getWishlist(token);
      set((state) => ({ ...state, wishlistItems: result.wishlist.items ?? [] }));
    } catch (err) {
      set((state) => ({
        ...state,
        fetchError: err instanceof Error ? err.message : "Failed to load wishlist",
      }));
    } finally {
      set((state) => ({ ...state, isLoading: false }));
    }
  },

  toggleWishlist: async (productId) => {
    const token = await resolveToken(get().token);
    if (!token) return;
    if (!lockItem(productId, set)) return;

    const snapshot = [...get().wishlistItems];
    const currentlyWishlisted = snapshot.some((item) => item.productId === productId);

    if (currentlyWishlisted) {
      set((state) => ({
        ...state,
        wishlistItems: state.wishlistItems.filter((item) => item.productId !== productId),
      }));
    } else {
      set((state) => ({
        ...state,
        wishlistItems: [
          {
            id: `optimistic_${productId}`,
            productId,
            createdAt: new Date().toISOString(),
            product: {
              id: productId,
              title: "",
              description: null,
              images: [],
              sellerPrice: null,
              adminListingPrice: null,
              price: null,
              adminPrice: null,
              salePrice: null,
              regularPrice: null,
              isPublished: true,
              category: null,
            },
          },
          ...state.wishlistItems,
        ],
      }));
    }

    try {
      await apiToggle(productId, token);
      await get().refreshWishlist();
    } catch (err) {
      set((state) => ({ ...state, wishlistItems: snapshot }));
      throw err;
    } finally {
      unlockItem(productId, set);
    }
  },

  removeFromWishlist: async (productId) => {
    const token = await resolveToken(get().token);
    if (!token) return;
    if (!lockItem(productId, set)) return;

    const snapshot = [...get().wishlistItems];
    set((state) => ({
      ...state,
      wishlistItems: state.wishlistItems.filter((item) => item.productId !== productId),
    }));

    try {
      await apiRemove(productId, token);
      await get().refreshWishlist();
    } catch (err) {
      set((state) => ({ ...state, wishlistItems: snapshot }));
      throw err;
    } finally {
      unlockItem(productId, set);
    }
  },

  bindAppState: () => {
    const handler = (state: AppStateStatus) => {
      if (state === "active") get().refreshWishlist();
    };
    const subscription = AppState.addEventListener("change", handler);
    return () => subscription.remove();
  },
}));
