import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { C } from "./theme";
import { T } from "./kit";

type Icon = React.ComponentProps<typeof Feather>["name"];

/** Meesho-style bottom navigation: five tabs, icon over label, brand colour when active. */
export const TABS: { route: string; path: string; label: string; icon: Icon }[] = [
  { route: "home/index", path: "/home", label: "Home", icon: "home" },
  { route: "categories", path: "/categories", label: "Categories", icon: "grid" },
  { route: "reels/index", path: "/reels", label: "Reels", icon: "play-circle" },
  { route: "orders/index", path: "/orders", label: "Orders", icon: "package" },
  { route: "profile", path: "/profile", label: "Account", icon: "user" },
];

export const TAB_BAR_HEIGHT = 56;

function Bar({ activeIndex, onPress }: { activeIndex: number; onPress: (i: number) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 4), height: TAB_BAR_HEIGHT + Math.max(insets.bottom, 4) }]} accessibilityRole="tablist">
      {TABS.map((t, i) => {
        const on = i === activeIndex;
        return (
          <Pressable key={t.route} onPress={() => onPress(i)} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
            {on ? <View style={styles.activeLine} /> : null}
            <Feather name={t.icon} size={21} color={on ? C.brandDark : C.muted} />
            <T size={10} w={on ? "semibold" : "medium"} color={on ? C.brandDark : C.muted} style={{ marginTop: 3 }}>{t.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tab bar for the (tabs) navigator. */
export function MeeshoTabBar({ state, navigation }: BottomTabBarProps) {
  const current = state.routes[state.index]?.name ?? "";
  const activeIndex = TABS.findIndex((t) => t.route === current || current.startsWith(`${t.route}/`));
  return (
    <Bar
      activeIndex={activeIndex}
      onPress={(i) => {
        const route = state.routes.find((r) => r.name === TABS[i]!.route);
        if (route) navigation.navigate(route.name, route.params);
      }}
    />
  );
}

/** Same bar for stack screens outside the tab navigator. */
export function StandaloneTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeIndex = TABS.findIndex((t) => pathname === t.path || pathname.startsWith(`${t.path}/`));
  return <Bar activeIndex={activeIndex} onPress={(i) => router.push(TABS[i]!.path as never)} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 6 },
  activeLine: { position: "absolute", top: 0, width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: C.brand },
});
