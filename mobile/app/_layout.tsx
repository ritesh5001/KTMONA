import * as React from "react";
import { Stack, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "../src/providers/AuthProvider";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { ToastProvider } from "../src/providers/ToastProvider";
import { NotificationProvider } from "../src/providers/NotificationProvider";
import { CartProvider } from "../src/providers/CartProvider";
import { AddressProvider } from "../src/providers/AddressProvider";
import { WishlistProvider } from "../src/providers/WishlistProvider";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { SessionExpiredModal } from "../src/components/SessionExpiredModal";
import { useNetworkStatus } from "../src/hooks/useNetworkStatus";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  queryClient,
  queryPersister,
  shouldPersistQuery,
} from "../src/providers/queryClient";
import { colors } from "../src/theme/tokens";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { GlobalBottomBar } from "../src/components/GlobalBottomBar";
import { useImageMemoryRelease } from "../src/lib/memory-pressure";
import { useRouteRestore } from "../src/lib/route-restore";
// import InAppUpdates, { IAUUpdateKind } from "react-native-in-app-updates";

// Keep the native launch artwork visible until the brand fonts are ready. A
// blank React tree produces a white flash on slower devices.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppShell() {
  const { isConnected } = useNetworkStatus();
  // Hand decoded bitmaps back to the OS whenever the app leaves the screen.
  useImageMemoryRelease();
  // Come back to the screen the shopper left, if Android killed us meanwhile.
  useRouteRestore();

  return (
    <>
      <OfflineBanner visible={!isConnected} />
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // Route changes must never compete with mounting a product grid,
          // video feed, or checkout tree.
          //
          // "Native transitions run on the UI thread, so they are free" is the
          // trap here, and it is wrong in the way that matters. The slide
          // itself does hit 60fps — but it has to composite a full-screen
          // layer for the incoming screen while that screen's React tree is
          // still mounting, laying out and rasterising on the other side. On
          // the product page (five context subscriptions, a gallery FlatList)
          // and Home (nested FlatLists) that is the heaviest work in the app,
          // and the two contend for the same frames no matter which thread
          // drives the animation. What the shopper sees is a screen sliding in
          // half-painted and then popping into place, which reads as a slow,
          // stuttering app.
          //
          // Interactive controls still animate, because a press-driven spring
          // on one small view competes with nothing. Screen changes are
          // deliberately immediate. Do not "restore" this without profiling on
          // a mid-range Android device first; it has been tried twice.
          animation: "none",
          gestureEnabled: true,
          // The single most important line in this file for sustained
          // performance.
          //
          // A native stack keeps every pushed screen mounted so the back gesture
          // can reveal it instantly. Without freezing, those mounted screens
          // also keep *re-rendering*: this app's product screen subscribes to
          // five contexts (auth, cart, wishlist, network, toast), so a single
          // add-to-cart re-rendered every product page still on the stack.
          //
          // "You may also like" lets a shopper chain product → product → product
          // without limit. Ten deep meant ten full product screens — ten
          // galleries, ten review lists, eighty related-product cards — all
          // re-rendering on every cart or wishlist change. That is why the app
          // was fine on launch and degraded the longer it was used, on fast
          // phones as well as slow ones.
          //
          // freezeOnBlur suspends rendering for anything not on screen. State is
          // kept, so going back is still instant; the work simply stops.
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="product/[id]/index" />
        <Stack.Screen name="checkout/index" />

        <Stack.Screen name="orders/[id]/index" />
        <Stack.Screen name="orders/[id]/tracking" />

        <Stack.Screen name="support/index" />
        <Stack.Screen name="support/[id]" />
      </Stack>
      <GlobalBottomBar />
    </>
  );
}

/**
 * Keep the route subscription isolated from the provider tree. When
 * `usePathname` lived in RootLayout, every navigation re-rendered every global
 * provider and the complete navigator while the transition was in progress.
 */
const AppStatusBar = React.memo(function AppStatusBar() {
  const pathname = usePathname();
  const immersive = pathname === "/reels" || pathname.startsWith("/reels/");

  return (
    <StatusBar
      barStyle={immersive ? "light-content" : "dark-content"}
      backgroundColor={immersive ? colors.media : colors.background}
      translucent={false}
    />
  );
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_300Light: require("../assets/fonts/CormorantGaramond_300Light.ttf"),
    CormorantGaramond_400Regular: require("../assets/fonts/CormorantGaramond_400Regular.ttf"),
    Inter_400Regular: require("../assets/fonts/Inter_400Regular.ttf"),
    Inter_500Medium: require("../assets/fonts/Inter_500Medium.ttf"),
  });

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1 }}>
      <AppStatusBar />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: queryPersister,
              dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
            }}
          >
            <ToastProvider>
              <AuthProvider>
                <SessionExpiredModal />
                <NotificationProvider>
                  <CartProvider>
                    <WishlistProvider>
                      <AddressProvider>
                        <AppShell />
                      </AddressProvider>
                    </WishlistProvider>
                  </CartProvider>
                </NotificationProvider>
              </AuthProvider>
            </ToastProvider>
          </PersistQueryClientProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
