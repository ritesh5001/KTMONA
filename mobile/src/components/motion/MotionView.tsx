import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { MotionPreset } from "../../lib/motion.config";

type MotionViewProps = React.PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  preset?: MotionPreset;
  delay?: number;
  duration?: number;
}>;

/**
 * A plain `View` with the same prop shape list rows have called it with —
 * `preset`/`delay`/`duration` are accepted and ignored rather than removed
 * from every call site.
 *
 * This used to run a Reanimated `entering` animation per row (fade, slide,
 * zoom) gated behind an `animateEntrance` prop no caller ever set, so every
 * cart and wishlist row was already paying for an extra `Animated.View`
 * wrapper for a transition that never fired. A prior, disabled version of
 * that entrance path is also the shape of thing that produced this app's
 * documented frame drops: JS-thread animation work landing on the exact
 * frames a list is mounting or recycling cells. Keep it a pass-through.
 */
export const MotionView = React.memo(function MotionView({
  children,
  style,
}: MotionViewProps) {
  return <View style={style}>{children}</View>;
});
