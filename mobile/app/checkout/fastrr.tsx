import * as React from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  ScrollView,
  Linking,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "../../src/theme/tokens";
import { AppHeader } from "../../src/components/AppHeader";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../src/components";
import { useAuth } from "../../src/hooks/useAuth";
import { useCart } from "../../src/providers/CartProvider";
import { useToast } from "../../src/providers/ToastProvider";
import { notifySuccess, notifyError } from "../../src/utils/haptics";
import { flushPendingCartWrite } from "../../src/lib/pending-cart";
import {
  buildFastrrCheckoutHtml,
  createFastrrSession,
  getFastrrBaseUrl,
  getFastrrSessionStatus,
  type FastrrSession,
} from "../../src/services/fastrr";

/**
 * Shiprocket Checkout (Fastrr) inside the app.
 *
 * Fastrr's checkout is a browser bundle, so it runs in a WebView. Three things
 * make that safe rather than fragile:
 *
 *   - The token is minted by the app over its own authenticated API and handed
 *     to the WebView in the document. The WebView never needs a login session,
 *     so there is no cookie sharing to get wrong.
 *
 *   - Completion is detected by watching for our own redirect URL, which the
 *     backend generated and Fastrr echoes back. Nothing in it is trusted — it
 *     only tells the app *when* to ask, and the backend then asks Fastrr.
 *
 *   - Nothing is torn down until the order is confirmed. A buyer who paid must
 *     never be dropped back onto a cart screen with their money gone.
 */

/** The order may land a beat after the redirect; poll rather than give up. */
const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 15;

type Phase = "loading" | "checkout" | "confirming" | "error";
type CompletionRoute = "/orders" | `/orders/${string}`;

export default function FastrrCheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session: authSession } = useAuth();
  const token = authSession?.accessToken ?? null;
  const { refreshCart } = useCart();
  const { showToast } = useToast();

  const params = useLocalSearchParams<{ buyNowVariantId?: string }>();
  const buyNowVariantId =
    typeof params.buyNowVariantId === "string" && params.buyNowVariantId
      ? params.buyNowVariantId
      : null;

  const [phase, setPhase] = React.useState<Phase>("loading");
  const [checkout, setCheckout] = React.useState<FastrrSession | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [completionRoute, setCompletionRoute] =
    React.useState<CompletionRoute | null>(null);
  const blocksExit = phase === "confirming" && completionRoute === null;

  const mountedRef = React.useRef(true);
  // Guards the confirm flow: the redirect can fire more than once as the WebView
  // follows it, and each would otherwise start its own poll loop.
  const confirmingRef = React.useRef(false);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Every route to the error screen, in one place.
   *
   * Nothing may overwrite the outcome once the payment is being confirmed: the
   * backend owns that answer, and a late load error from a WebView that is
   * already being torn down must never tell a buyer who has paid that their
   * checkout failed.
   */
  const fail = React.useCallback((message: string) => {
    if (!mountedRef.current) return;
    if (confirmingRef.current) return;
    setError(message);
    setPhase("error");
  }, []);

  // ---------------------------------------------------------------------
  // Open the checkout
  // ---------------------------------------------------------------------

  const start = React.useCallback(async () => {
    setPhase("loading");
    setError(null);
    setCompletionRoute(null);

    try {
      // Buy Now navigates here while its add-to-cart may still be in flight.
      await flushPendingCartWrite();

      const created = await createFastrrSession(
        buyNowVariantId ? { variantIds: [buyNowVariantId] } : {},
        token
      );

      if (!mountedRef.current) return;
      setCheckout(created);
      setPhase("checkout");
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Could not start express checkout"
      );
      setPhase("error");
    }
  }, [buyNowVariantId, token]);

  React.useEffect(() => {
    void start();
  }, [start]);

  // ---------------------------------------------------------------------
  // Resolve the outcome
  // ---------------------------------------------------------------------

  const confirm = React.useCallback(
    async (sessionId: string) => {
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      setPhase("confirming");

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        if (!mountedRef.current) return;

        try {
          const status = await getFastrrSessionStatus(sessionId, token);

          if (status.status === "COMPLETED" && status.orderId) {
            notifySuccess();
            void refreshCart();
            if (!mountedRef.current) return;
            setCompletionRoute(`/orders/${status.orderId}`);
            return;
          }

          if (status.status === "FAILED") {
            notifyError();
            if (!mountedRef.current) return;
            setError(status.message || "Your payment was not completed.");
            setPhase("error");
            confirmingRef.current = false;
            return;
          }
        } catch {
          // Network blips are expected right after a payment redirect; keep
          // trying rather than telling a buyer who paid that it failed.
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!mountedRef.current) return;

      // Still unresolved. Never present this as a failure — the money may well
      // have moved, and the backend's reconciliation sweep will place the order
      // even if every webhook was lost. Send them where it will appear.
      void refreshCart();
      showToast(
        "Your order is being finalised — it will appear in My Orders shortly.",
        "info"
      );
      setCompletionRoute("/orders");
    },
    [refreshCart, showToast, token]
  );

  /**
   * Fastrr sends the buyer to the redirect URL the backend registered when the
   * token was minted. Matching on its path is how the app knows the overlay is
   * done — the query string it carries is not trusted for anything else.
   */
  const handleNavigation = React.useCallback(
    (event: WebViewNavigation): boolean => {
      if (!checkout) return true;

      // UPI apps are launched by navigating to their own scheme. A WebView
      // cannot load `upi://` or `phonepe://` and reports it as a failed page,
      // so these have to be handed to the OS instead of followed here.
      if (!/^https?:\/\//i.test(event.url)) {
        void Linking.openURL(event.url).catch(() => {
          fail(
            "No app is installed that can handle this payment method. Please choose another."
          );
        });
        return false;
      }

      if (!event.url.includes("/checkout/fastrr/callback")) return true;

      let sessionId = checkout.sessionId;
      try {
        const returned = new URL(event.url).searchParams.get("sid");
        if (returned) sessionId = returned;
      } catch {
        // Malformed URL — fall back to the session we already hold.
      }

      void confirm(sessionId);

      // Stop the WebView from actually loading our website, which would ask for
      // a login the WebView does not have.
      return false;
    },
    [checkout, confirm, fail]
  );

  const handleMessage = React.useCallback((raw: string) => {
    try {
      const message = JSON.parse(raw) as { type?: string; message?: string };
      if (message.type !== "error" && message.type !== "script-error") return;
      fail(message.message || "Checkout failed to load");
    } catch {
      // Fastrr's own bundle also posts messages; anything unparseable is theirs.
    }
  }, [fail]);

  // Keep every navigation path (header, native gesture, and programmatic pop)
  // on this screen while the backend is resolving a potentially paid order.
  // Native-stack also uses this hook to set preventNativeDismiss on iOS.
  usePreventRemove(blocksExit, () => {
    showToast("Please wait while we confirm your payment.", "info");
  });

  // The prevent-remove guard must be released before navigating to a confirmed
  // destination, otherwise it would also block our own replace action.
  React.useEffect(() => {
    if (!completionRoute) return;
    router.replace(completionRoute);
  }, [completionRoute, router]);

  // Back during confirmation would strand a paid order on a screen the buyer
  // can never return to, so it is blocked until the outcome is known.
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => blocksExit
    );
    return () => subscription.remove();
  }, [blocksExit]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            gestureEnabled: true,
            headerBackButtonMenuEnabled: false,
          }}
        />
        <AppHeader title="Checkout" />
        {/* Scrollable: a gateway error can be several lines long, and the whole
            point of this screen is that the buyer can read it. */}
        <ScrollView contentContainerStyle={styles.centered}>
          <Text style={styles.title}>We couldn&apos;t open checkout</Text>
          <Text style={styles.body}>
            {error ?? "Something went wrong. Please try again."}
          </Text>

          <AnimatedPressable style={styles.primaryButton} onPress={() => void start()}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </AnimatedPressable>

          {/* Always a way out: the native checkout still works even when
              Fastrr's does not. */}
          <AnimatedPressable
            style={styles.secondaryButton}
            onPress={() =>
              router.replace(
                buyNowVariantId
                  ? `/checkout?express=off&buyNowVariantId=${encodeURIComponent(buyNowVariantId)}`
                  : "/checkout?express=off"
              )
            }
          >
            <Text style={styles.secondaryButtonText}>Use Standard Checkout</Text>
          </AnimatedPressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          gestureEnabled: !blocksExit,
          headerBackButtonMenuEnabled: false,
        }}
      />
      <AppHeader
        title="Secure checkout"
        subtitle={phase === "confirming" ? "Confirming payment" : "Protected payment"}
        showBack={phase !== "confirming"}
      />

      {checkout && phase !== "confirming" ? (
        <WebView
          source={{
            html: buildFastrrCheckoutHtml(checkout),
            // Must be the *store's* origin: Fastrr identifies the merchant from
            // the hosting page's host. See getFastrrBaseUrl.
            baseUrl: getFastrrBaseUrl(checkout),
          }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          // Payment pages routinely open UPI apps and bank 3-D Secure pages in
          // a new window; without this they silently do nothing.
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={handleNavigation}
          onMessage={(event) => handleMessage(event.nativeEvent.data)}
          // The reason is the whole point. Reporting a bare "Checkout failed to
          // load" threw away the code, description and URL the WebView had
          // already worked out, which left no way to tell a blocked payment host
          // from a dead session from a network drop.
          onError={(event) => {
            const { code, description, url } = event.nativeEvent;
            fail(
              [
                description || "The checkout page could not be loaded",
                code !== undefined ? `(code ${code})` : null,
                url ? `\n${url}` : null,
              ]
                .filter(Boolean)
                .join(" ")
            );
          }}
          onHttpError={(event) => {
            const { statusCode, url } = event.nativeEvent;
            fail(`Checkout returned HTTP ${statusCode}.\n${url ?? ""}`.trim());
          }}
          style={[styles.webview, { marginBottom: insets.bottom }]}
        />
      ) : null}

      {phase !== "checkout" ? (
        <View style={styles.overlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.overlayText}>
            {phase === "confirming"
              ? "Confirming your order — please don't close this screen."
              : "Opening secure checkout…"}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  webview: { flex: 1, backgroundColor: colors.background },
  centered: {
    // flexGrow, not flex: this is a ScrollView content container, which must be
    // free to exceed the viewport when the message is long.
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.serif,
    fontSize: 26,
    color: colors.charcoal,
    textAlign: "center",
  },
  body: {
    fontFamily: typography.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.brownSoft,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    backgroundColor: colors.gold,
  },
  primaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.background,
  },
  secondaryButton: {
    width: "100%",
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  overlayText: {
    fontFamily: typography.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.brownSoft,
    textAlign: "center",
  },
});
