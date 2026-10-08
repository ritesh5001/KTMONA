import * as React from "react";
import { useRouter } from "expo-router";
import { AppState, Platform, type AppStateStatus } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "./ToastProvider";
import {
  getExpoPushToken,
  registerDeviceToken,
  configureForegroundPresentation,
} from "../services/push";
import { getUnreadCount } from "../services/notifications";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface NotificationContextValue {
  /** Unread notification badge count. */
  unreadCount: number;
  /** Refresh badge count from the server. */
  refreshUnreadCount: () => Promise<void>;
  /** Decrement badge locally (optimistic on mark-read). */
  decrementUnread: () => void;
  /** Increment badge locally (on push received). */
  incrementUnread: () => void;
}

const NotificationContext = React.createContext<NotificationContextValue>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  decrementUnread: () => {},
  incrementUnread: () => {},
});

export function useNotifications() {
  return React.useContext(NotificationContext);
}

// ---------------------------------------------------------------------------
// Deep-link routing map
// ---------------------------------------------------------------------------
type NotificationData = {
  type?: string;
  orderId?: string;
  [key: string]: unknown;
};

function routeForNotification(data: NotificationData): string | null {
  if (!data.type) return null;
  switch (data.type) {
    case "ORDER_PLACED":
    case "ORDER_SHIPPED":
    case "ORDER_DELIVERED":
    case "PAYMENT_SUCCESS":
    case "PAYMENT_FAILED":
      return data.orderId ? `/orders/${data.orderId}` : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const token = session?.accessToken ?? null;
  const router = useRouter();
  const { showToast } = useToast();
  const isExpoGo = Constants.appOwnership === "expo";
  const supportsNativePush = Platform.OS !== "web" && !isExpoGo;

  const [unreadCount, setUnreadCount] = React.useState(0);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---- Badge helpers ----
  const refreshUnreadCount = React.useCallback(async () => {
    if (!token) return;
    const count = await getUnreadCount(token);
    if (mountedRef.current) setUnreadCount(count);
  }, [token]);

  const decrementUnread = React.useCallback(() => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const incrementUnread = React.useCallback(() => {
    setUnreadCount((prev) => prev + 1);
  }, []);

  // ---- On auth ready: configure + register + fetch count ----
  React.useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    if (!supportsNativePush) {
      refreshUnreadCount();
      return;
    }

    void configureForegroundPresentation();

    let cancelled = false;

    (async () => {
      // Register device (best-effort — won't block UI)
      const pushToken = await getExpoPushToken();
      if (!pushToken && !cancelled) {
        // Permission denied or simulator — inform user once
        // (getExpoPushToken already logged the reason)
      }
      if (pushToken && !cancelled) {
        await registerDeviceToken(token);
      }

      // Fetch initial unread count
      if (!cancelled) {
        await refreshUnreadCount();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, refreshUnreadCount, supportsNativePush]);

  // ---- Foreground listener: toast + increment badge ----
  React.useEffect(() => {
    if (!token || !supportsNativePush) return;

    let subscription: { remove: () => void } | null = null;
    let active = true;

    (async () => {
      const Notifications = await import("expo-notifications");
      if (!active) return;
      subscription = Notifications.addNotificationReceivedListener(
        (notification) => {
          const title =
            notification.request.content.title ?? "New notification";
          showToast(title, "info");
          incrementUnread();
        }
      );
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [token, supportsNativePush, showToast, incrementUnread]);

  // ---- Tap / response listener: deep link ----
  React.useEffect(() => {
    if (!token || !supportsNativePush) return;

    let subscription: { remove: () => void } | null = null;
    let active = true;

    (async () => {
      const Notifications = await import("expo-notifications");
      if (!active) return;
      subscription =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const data = (response.notification.request.content.data ??
            {}) as NotificationData;
          const route = routeForNotification(data);
          if (route) {
            router.push(route as any);
          }
        });
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [token, supportsNativePush, router]);

  // ---- Refresh count when app comes to foreground ----
  React.useEffect(() => {
    if (!token) return;

    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        refreshUnreadCount();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [token, refreshUnreadCount]);

  // ---- Context value ----
  const value = React.useMemo<NotificationContextValue>(
    () => ({ unreadCount, refreshUnreadCount, decrementUnread, incrementUnread }),
    [unreadCount, refreshUnreadCount, decrementUnread, incrementUnread]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
