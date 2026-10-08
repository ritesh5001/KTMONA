import * as React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "../theme/tokens";

/**
 * The ornament that sits above a section heading.
 *
 * This replaces the sparkle glyph that was marking every section on the home
 * screen. A sparkle is the visual shorthand for "AI did this" — it belongs on a
 * generate button, not above SHOP THE OCCASION, and repeating it four times down
 * one page made the page read like a tech demo rather than a catalogue.
 *
 * A rule broken by a small diamond is the traditional editorial section mark:
 * it says "a new chapter starts here" without naming a feature. The rules draw
 * themselves outward on mount, which gives the section a beat of arrival at no
 * cost — the whole thing is two views and a transform on the UI thread.
 */
export function SectionMark({
  color = colors.gold,
  width = 26,
  animate = false,
}: {
  color?: string;
  /** Length of each rule either side of the diamond. */
  width?: number;
  animate?: boolean;
}) {
  const draw = useSharedValue(animate ? 0 : 1);

  React.useEffect(() => {
    if (!animate) return;
    draw.value = withDelay(
      80,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })
    );
  }, [animate, draw]);

  const ruleStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: draw.value }],
  }));

  const diamondStyle = useAnimatedStyle(() => ({
    opacity: draw.value,
    transform: [{ rotate: "45deg" }, { scale: 0.4 + 0.6 * draw.value }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.rule,
          { width, backgroundColor: color, transformOrigin: "right" },
          ruleStyle,
        ]}
      />
      <Animated.View
        style={[styles.diamond, { backgroundColor: color }, diamondStyle]}
      />
      <Animated.View
        style={[
          styles.rule,
          { width, backgroundColor: color, transformOrigin: "left" },
          ruleStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 20,
  },
  rule: {
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.55,
    borderRadius: radius.pill,
  },
  diamond: {
    width: 5,
    height: 5,
  },
});
