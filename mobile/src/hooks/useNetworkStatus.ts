import * as React from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

// ---------------------------------------------------------------------------
// Hook: useNetworkStatus
// ---------------------------------------------------------------------------
export interface NetworkStatus {
  /** `true` when the device has connectivity. Defaults to `true` (optimistic). */
  isConnected: boolean;
  /** `true` during the first read before NetInfo has reported. */
  isLoading: boolean;
}

/**
 * Provides live network connectivity state.
 *
 * - Subscribes once on mount, unsubscribes on unmount.
 * - Merges `isConnected` and `isInternetReachable` when available.
 * - Returns optimistic `true` until the first probe completes.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = React.useState<NetworkStatus>({
    isConnected: true,
    isLoading: true,
  });

  React.useEffect(() => {
    let mounted = true;

    const handleChange = (state: NetInfoState) => {
      if (!mounted) return;
      // isInternetReachable can be null while still probing; fall back to isConnected
      const connected =
        state.isInternetReachable ?? state.isConnected ?? true;
      setStatus({ isConnected: !!connected, isLoading: false });
    };

    const unsubscribe = NetInfo.addEventListener(handleChange);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return status;
}
