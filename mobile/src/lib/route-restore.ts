import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";

/**
 * Return the shopper to the screen they left, after Android kills the process.
 *
 * Android reclaims backgrounded apps under memory pressure, and several OEMs
 * common in India (Xiaomi, Realme, Oppo, Vivo) do it far more aggressively than
 * stock. When that happens the whole JS runtime is gone: the app cold-starts and
 * expo-router lands on its initial route. To the shopper it looks like the app
 * "forgot" where they were — they were on a product, switched to WhatsApp, came
 * back, and are staring at the home screen.
 *
 * There is no way to stop the OS killing the process. What can be fixed is
 * coming back to the right place, so the kill is invisible.
 *
 * The last route is recorded as it changes and replayed once on the next cold
 * start. Deliberately conservative about what it will restore:
 *
 *   · Only within RESTORE_WINDOW_MS. Returning after a day should feel like
 *     opening the app fresh, not resuming a stale session.
 *   · Never into a transient flow. Checkout, payment and auth screens depend on
 *     in-memory state that died with the process — dropping someone back into a
 *     half-finished payment would be worse than sending them home.
 *   · Once per launch, and never over a deep link. If the app was opened by a
 *     notification or a shared product link, that destination wins.
 */

const STORAGE_KEY = "KTMONA_LAST_ROUTE_V1";

/** Older than this and a cold start should just go home. */
const RESTORE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Routes that must never be restored.
 *
 * These own state that does not survive the process: a PhonePe attempt in
 * flight, a half-entered address, an OTP awaiting verification. Resuming them
 * would show a screen that cannot function.
 */
const NEVER_RESTORE = [
  "/checkout",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/request-otp",
  "/verify-otp",
  "/_sitemap",
];

/** The route the app already opens on — restoring it is a no-op. */
const DEFAULT_ROUTE = "/home";

type StoredRoute = { path: string; at: number };

function isRestorable(path: string): boolean {
  if (!path || path === "/" || path === DEFAULT_ROUTE) return false;
  return !NEVER_RESTORE.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function useRouteRestore(): void {
  const router = useRouter();
  const pathname = usePathname();
  // Undefined until the navigator has mounted. Navigating before that throws.
  const navigationState = useRootNavigationState();
  const isNavigatorReady = Boolean(navigationState?.key);

  const hasRestoredRef = React.useRef(false);
  // Where the app landed on this launch. A deep link or notification will have
  // set this to something other than the default, and that must not be
  // overridden by a stale saved route.
  const launchPathRef = React.useRef<string | null>(null);

  // ---- Restore, once, as soon as the navigator can accept it ----
  React.useEffect(() => {
    if (!isNavigatorReady || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    if (launchPathRef.current === null) {
      launchPathRef.current = pathname;
    }

    // Opened via a deep link — honour it and leave the saved route alone.
    if (launchPathRef.current !== DEFAULT_ROUTE && launchPathRef.current !== "/") {
      return;
    }

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const stored = JSON.parse(raw) as StoredRoute;
        if (!stored?.path || typeof stored.at !== "number") return;
        if (Date.now() - stored.at > RESTORE_WINDOW_MS) return;
        if (!isRestorable(stored.path)) return;

        // `replace`, not `push`: the shopper should not be able to press back
        // into an empty history from a screen they were already on.
        router.replace(stored.path as never);
      } catch {
        // A corrupt or unreadable entry is not worth failing a launch over —
        // the app simply opens where it normally would.
      }
    })();
  }, [isNavigatorReady, pathname, router]);

  // ---- Record the current route ----
  React.useEffect(() => {
    if (!isNavigatorReady || !pathname) return;
    if (!isRestorable(pathname)) return;

    // Written on a short delay so a burst of navigation only costs one write,
    // and so a screen passed straight through is never recorded as the
    // destination.
    const timer = setTimeout(() => {
      const entry: StoredRoute = { path: pathname, at: Date.now() };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry)).catch(
        () => undefined
      );
    }, 400);

    return () => clearTimeout(timer);
  }, [isNavigatorReady, pathname]);
}
