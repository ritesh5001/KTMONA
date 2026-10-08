import * as React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBarItem } from "./TabBarItem";
import type { IconName } from "./Icon";
import { colors, radius } from "../theme/tokens";

type NavItem = {
  label: string;
  path: string;
  icon: IconName;
};

export const APP_BOTTOM_BAR_HEIGHT = 64;

export function getBottomBarTotalHeight(insetBottom: number): number {
  return APP_BOTTOM_BAR_HEIGHT + Math.max(insetBottom, 6);
}

const TAB_ROUTE_PREFIXES = [
  "/home",
  "/marketplace",
  "/reels",
  "/try-buy",
  "/search",
  "/profile",
  "/cart",
  "/wishlist",
  "/orders",
  "/notifications",
  "/categories",
  "/privacy-policy",
  "/return-policy",
  "/refund-policy",
  "/terms",
  "/contact",
];

const NAV_ITEMS: NavItem[] = [
  { label: "Home", path: "/home", icon: "home" },
  { label: "Shop", path: "/marketplace", icon: "grid" },
  { label: "Reels", path: "/reels", icon: "play-circle-outline" },
  { label: "Profile", path: "/profile", icon: "user" },
];

function isTabRoute(pathname: string): boolean {
  return TAB_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Routes where the bottom bar should be hidden (focused flows with their own CTA). */
const HIDDEN_ROUTE_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/request-otp",
  "/verify-otp",
  "/reset-password",
  "/product",
  "/checkout",
];

export function shouldHideBottomBar(pathname: string): boolean {
  if (isTabRoute(pathname)) return true;
  return HIDDEN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Thin adapter from this bar's `NavItem` shape onto the shared `TabBarItem`. */
const BottomBarItem = React.memo(function BottomBarItem({
  item,
  isFocused,
  onPress,
}: {
  item: NavItem;
  isFocused: boolean;
  onPress: (path: string) => void;
}) {
  const handlePress = React.useCallback(() => {
    onPress(item.path);
  }, [item.path, onPress]);

  return (
    <TabBarItem
      label={item.label}
      icon={item.icon}
      isFocused={isFocused}
      onPress={handlePress}
      accessibilityLabel={item.label}
    />
  );
});

export function GlobalBottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const currentIndex = React.useMemo(() => {
    const found = NAV_ITEMS.findIndex(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
    );
    return found;
  }, [pathname]);

  const itemWidth = windowWidth / NAV_ITEMS.length;
  const indicatorWidth = Math.min(itemWidth - 14, 84);
  const indicatorLeft =
    currentIndex * itemWidth + (itemWidth - indicatorWidth) / 2;

  const handlePress = React.useCallback(
    (path: string) => {
      router.push(path as never);
    },
    [router]
  );

  if (shouldHideBottomBar(pathname)) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 6),
          height: getBottomBarTotalHeight(insets.bottom),
        },
      ]}
      accessibilityRole="tablist"
      accessibilityLabel="Primary navigation"
    >
      {/* Behind the icons, so it reads as a surface the tab sits on rather than
          a badge stuck to it. */}
      {currentIndex >= 0 ? (
        <View
          style={[styles.indicator, { left: indicatorLeft, width: indicatorWidth }]}
        />
      ) : null}

      {NAV_ITEMS.map((item, index) => (
        <BottomBarItem
          key={item.path}
          item={item}
          isFocused={index === currentIndex}
          onPress={handlePress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: APP_BOTTOM_BAR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 138, 0, 0.3)",
    backgroundColor: colors.surfaceElevated,
    flexDirection: "row",
    shadowColor: colors.charcoal,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 12,
    elevation: 12,
  },
  indicator: {
    position: "absolute",
    top: 5,
    left: 0,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(128, 96, 61, 0.22)",
    backgroundColor: "rgba(128, 96, 61, 0.09)",
  },
});
