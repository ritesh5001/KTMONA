import * as React from "react";
import { Pressable, StyleSheet } from "react-native";
import { AppText as Text } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { colors, typography } from "../theme/tokens";

/**
 * One tab in the bottom bar, shared by `AnimatedTabBar` (the tab navigator's
 * own bar) and `GlobalBottomBar` (the lookalike shown on routes outside the
 * tab group). Both rendered their own near-identical copy of this before.
 *
 * Selection is a static swap on purpose. Every animated version of this has
 * been reverted for the same reason: whatever drives it — a Reanimated spring
 * shared across all four tabs, or a per-item native-driver timing — it fires on
 * the exact frames the destination tab is mounting a product grid or a video
 * feed, and that is where this app's dropped frames come from. The tab bar is
 * the one surface guaranteed to be on screen during every heavy mount in the
 * app, so it is the last place that should be animating.
 */
export const TabBarItem = React.memo(function TabBarItem({
  label,
  icon,
  isFocused,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  icon: IconName;
  isFocused: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={`Switches to ${label}`}
      accessibilityState={{ selected: isFocused }}
      testID={testID}
    >
      <Icon
        name={icon}
        size={21}
        color={isFocused ? colors.gold : colors.brownSoft}
      />
      <Text style={[styles.label, isFocused && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    fontFamily: typography.sans,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.55,
    textTransform: "uppercase",
    color: colors.brownSoft,
  },
  activeLabel: {
    color: colors.gold,
  },
});
