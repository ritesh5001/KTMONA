import * as React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "./ToastProvider";
import { isAbortError } from "../services/api";
import {
  getAddresses,
  createAddress as apiCreateAddress,
  updateAddress as apiUpdateAddress,
  deleteAddress as apiDeleteAddress,
  setDefaultAddress as apiSetDefaultAddress,
  type Address,
  type CreateAddressPayload,
  type UpdateAddressPayload,
} from "../services/addresses";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AddressContextValue {
  /** All saved addresses, sorted default-first. */
  addresses: Address[];
  /** The default address (if any). */
  defaultAddress: Address | null;
  /** True while the initial fetch is in-flight. */
  isLoading: boolean;
  /** Non-null error string when the last fetch failed. */
  fetchError: string | null;
  /** True while any mutation is in-flight. */
  isMutating: boolean;
  /** Set of address IDs currently being mutated. */
  mutatingIds: ReadonlySet<string>;
  /** Force-refresh from server. */
  refreshAddresses: () => Promise<void>;
  /** Create a new address. Returns it on success. */
  addAddress: (data: CreateAddressPayload) => Promise<Address | null>;
  /** Update an existing address. Returns it on success. */
  editAddress: (
    id: string,
    data: UpdateAddressPayload,
  ) => Promise<Address | null>;
  /** Delete an address (optimistic). */
  removeAddress: (id: string) => Promise<void>;
  /** Mark an address as default (optimistic). */
  setDefault: (id: string) => Promise<void>;
}

const AddressContext = React.createContext<AddressContextValue>({
  addresses: [],
  defaultAddress: null,
  isLoading: true,
  fetchError: null,
  isMutating: false,
  mutatingIds: new Set(),
  refreshAddresses: async () => {},
  addAddress: async () => null,
  editAddress: async () => null,
  removeAddress: async () => {},
  setDefault: async () => {},
});

export function useAddresses() {
  return React.useContext(AddressContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AddressProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const token = session?.accessToken ?? null;
  const { showToast } = useToast();

  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Per-item synchronous ref lock (same pattern as CartProvider)
  const [mutatingIds, setMutatingIds] = React.useState<Set<string>>(
    new Set(),
  );
  const mutationLockRef = React.useRef<Set<string>>(new Set());
  const mountedRef = React.useRef(true);
  const fetchAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
      fetchAbortRef.current?.abort();
    };
  }, []);

  // Derived
  const isMutating = mutatingIds.size > 0;
  const defaultAddress = React.useMemo(
    () => addresses.find((a) => a.isDefault) ?? null,
    [addresses],
  );

  // ---- Lock / unlock helpers (synchronous ref-first) ----

  const lockItem = React.useCallback((id: string): boolean => {
    if (mutationLockRef.current.has(id)) return false;
    mutationLockRef.current.add(id);
    setMutatingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    return true;
  }, []);

  const unlockItem = React.useCallback((id: string) => {
    mutationLockRef.current.delete(id);
    setMutatingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ---- Fetch addresses ----

  const refreshAddresses = React.useCallback(async () => {
    if (!token) return;

    // Abort any previous in-flight fetch
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      setFetchError(null);
      const result = await getAddresses(controller.signal);
      if (mountedRef.current && !controller.signal.aborted) {
        setAddresses(result);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      if (mountedRef.current) {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load addresses",
        );
      }
    }
  }, [token]);

  // ---- Initial + auth-change load ----

  React.useEffect(() => {
    if (!token) {
      // Logged out → clear everything
      mutationLockRef.current.clear();
      setAddresses([]);
      setIsLoading(false);
      setFetchError(null);
      setMutatingIds(new Set());
      fetchAbortRef.current?.abort();
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    (async () => {
      setIsLoading(true);
      try {
        const result = await getAddresses(controller.signal);
        if (!cancelled && mountedRef.current) {
          setAddresses(result);
        }
      } catch (err) {
        if (isAbortError(err) || cancelled) return;
        if (mountedRef.current) {
          setFetchError(
            err instanceof Error ? err.message : "Failed to load addresses",
          );
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token]);

  // ---- Auto-refresh when app comes to foreground ----

  React.useEffect(() => {
    if (!token) return;

    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        refreshAddresses();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [token, refreshAddresses]);

  // ---- Add address ----

  const addAddress = React.useCallback(
    async (data: CreateAddressPayload): Promise<Address | null> => {
      if (!token) return null;

      const tempKey = `add_${Date.now()}`;
      if (!lockItem(tempKey)) return null;

      try {
        const created = await apiCreateAddress(data);
        // Full refresh to get consistent server state
        await refreshAddresses();
        return created;
      } catch (err) {
        if (!isAbortError(err)) {
          const msg =
            err instanceof Error ? err.message : "Failed to add address";
          showToast(msg, "error");
        }
        return null;
      } finally {
        if (mountedRef.current) unlockItem(tempKey);
      }
    },
    [token, lockItem, unlockItem, refreshAddresses, showToast],
  );

  // ---- Edit address ----

  const editAddress = React.useCallback(
    async (
      id: string,
      data: UpdateAddressPayload,
    ): Promise<Address | null> => {
      if (!token) return null;
      if (!lockItem(id)) return null;

      try {
        const updated = await apiUpdateAddress(id, data);
        // Full refresh for consistency
        await refreshAddresses();
        return updated;
      } catch (err) {
        if (!isAbortError(err)) {
          const msg =
            err instanceof Error ? err.message : "Failed to update address";
          showToast(msg, "error");
        }
        return null;
      } finally {
        if (mountedRef.current) unlockItem(id);
      }
    },
    [token, lockItem, unlockItem, refreshAddresses, showToast],
  );

  // ---- Delete address (optimistic) ----

  const removeAddress = React.useCallback(
    async (id: string): Promise<void> => {
      if (!token) return;
      if (!lockItem(id)) return;

      const snapshot = [...addresses];

      // Optimistic removal
      setAddresses((prev) => prev.filter((a) => a.id !== id));

      try {
        await apiDeleteAddress(id);
        // Re-sync with server truth
        await refreshAddresses();
      } catch (err) {
        if (!isAbortError(err)) {
          if (mountedRef.current) setAddresses(snapshot);
          const msg =
            err instanceof Error ? err.message : "Failed to delete address";
          showToast(msg, "error");
        }
      } finally {
        if (mountedRef.current) unlockItem(id);
      }
    },
    [token, addresses, lockItem, unlockItem, refreshAddresses, showToast],
  );

  // ---- Set default (optimistic) ----

  const setDefault = React.useCallback(
    async (id: string): Promise<void> => {
      if (!token) return;
      if (!lockItem(id)) return;

      const snapshot = [...addresses];

      // Optimistic: toggle default flags locally
      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          isDefault: a.id === id,
        })),
      );

      try {
        await apiSetDefaultAddress(id);
        await refreshAddresses();
      } catch (err) {
        if (!isAbortError(err)) {
          if (mountedRef.current) setAddresses(snapshot);
          const msg =
            err instanceof Error
              ? err.message
              : "Failed to set default address";
          showToast(msg, "error");
        }
      } finally {
        if (mountedRef.current) unlockItem(id);
      }
    },
    [token, addresses, lockItem, unlockItem, refreshAddresses, showToast],
  );

  // ---- Context value ----

  const value = React.useMemo<AddressContextValue>(
    () => ({
      addresses,
      defaultAddress,
      isLoading,
      fetchError,
      isMutating,
      mutatingIds,
      refreshAddresses,
      addAddress,
      editAddress,
      removeAddress,
      setDefault,
    }),
    [
      addresses,
      defaultAddress,
      isLoading,
      fetchError,
      isMutating,
      mutatingIds,
      refreshAddresses,
      addAddress,
      editAddress,
      removeAddress,
      setDefault,
    ],
  );

  return (
    <AddressContext.Provider value={value}>{children}</AddressContext.Provider>
  );
}
