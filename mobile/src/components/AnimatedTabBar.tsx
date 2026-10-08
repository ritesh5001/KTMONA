import * as React from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { TabBarItem } from "./TabBarItem";
import type { IconName } from "./Icon";
import { colors, radius } from "../theme/tokens";

/**
 * The bottom bar the shopper actually sees.
 *
 * The tab routes render the navigator's own bar, not `GlobalBottomBar` — that
 * one only appears on the handful of routes outside the tab set. So the premium
 * treatment has to live here or it never shows up on Home, Shop, Reels or
 * Profile.
 *
 * The selection indicator's position is a plain style value recomputed on
 * render, not an animated one — it never moves *across* the bar on its own,
 * it simply appears in the right place, so there is nothing here competing
 * with the destination tab mounting. The per-item settle animation lives in
 * `TabBarItem` and is scoped to the one tab whose focus changed.
 */

/** Only these appear in the bar; every other registered screen is `href: null`. */
const VISIBLE_TABS: { name: string; label: string; icon: IconName }[] = [
  { name: "home/index", label: "Home", icon: "home" },
  { name: "marketplace/index", label: "Shop", icon: "grid" },
  { name: "reels/index", label: "Reels", icon: "play-circle-outline" },
  { name: "profile", label: "Profile", icon: "user" },
];

export function AnimatedTabBar({
  state,
  navigation,
  descriptors,
  insets,
}: BottomTabBarProps) {
  const { width: windowWidth } = useWindowDimensions();

  // Map the navigator's route index onto our visible subset. Hidden routes keep
  // the pill where it was rather than sending it off the end of the bar.
  const activeName = state.routes[state.index]?.name;
  const foundVisibleIndex = React.useMemo(
    () => VISIBLE_TABS.findIndex((tab) => tab.name === activeName),
    [activeName]
  );
  const lastVisibleIndexRef = React.useRef(
    foundVisibleIndex >= 0 ? foundVisibleIndex : 0
  );
  const visibleIndex =
    foundVisibleIndex >= 0 ? foundVisibleIndex : lastVisibleIndexRef.current;

  React.useEffect(() => {
    if (foundVisibleIndex >= 0) lastVisibleIndexRef.current = foundVisibleIndex;
  }, [foundVisibleIndex]);

  const itemWidth = windowWidth / VISIBLE_TABS.length;
  const indicatorWidth = Math.min(itemWidth - 14, 84);
  const indicatorLeft =
    visibleIndex * itemWidth + (itemWidth - indicatorWidth) / 2;

  const bottomPadding = Math.max(insets.bottom, 6);

  // Only the navigator's own bar reports its height, so replacing it would
  // leave `useBottomTabBarHeight()` on a stale default — and the cart's pinned
  // summary would sit partly underneath this bar. Report it ourselves.
  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);
  const handleLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      onHeightChange?.(event.nativeEvent.layout.height);
    },
    [onHeightChange]
  );

  const handlePress = React.useCallback(
    (name: string, isFocused: boolean) => {
      const route = state.routes.find((r) => r.name === name);
      if (!route) return;

      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    },
    [navigation, state.routes]
  );

  const handleLongPress = React.useCallback(
    (name: string) => {
      const route = state.routes.find((item) => item.name === name);
      if (!route) return;
      navigation.emit({ type: "tabLongPress", target: route.key });
    },
    [navigation, state.routes]
  );

  return (
    <View
      onLayout={handleLayout}
      accessibilityRole="tablist"
      accessibilityLabel="Primary navigation"
      style={[
        styles.wrapper,
        { paddingBottom: bottomPadding, height: 64 + bottomPadding },
      ]}
    >
      {/* Behind the icons, so it reads as a surface the tab rests on rather
          than a badge stuck to it. */}
      <View
        style={[styles.indicator, { left: indicatorLeft, width: indicatorWidth }]}
      />

      {VISIBLE_TABS.map((tab) => {
        const route = state.routes.find((item) => item.name === tab.name);
        const options = route ? descriptors[route.key]?.options : undefined;
        // A hidden route may retain this tab's indicator position, but it is not
        // the focused route. Keeping those concepts separate also ensures the
        // retained tab remains a working way back to its screen.
        const isFocused = tab.name === activeName;
        return (
          <TabBarItem
            key={tab.name}
            label={tab.label}
            icon={tab.icon}
            isFocused={isFocused}
            accessibilityLabel={options?.tabBarAccessibilityLabel ?? tab.label}
            testID={options?.tabBarButtonTestID}
            onPress={() => handlePress(tab.name, isFocused)}
            onLongPress={() => handleLongPress(tab.name)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 138, 0, 0.3)",
    backgroundColor: colors.surfaceElevated,
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
