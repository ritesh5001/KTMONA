import * as React from "react";
import { type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { MotionPressable } from "./motion/MotionPressable";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AnimatedPressableProps extends Omit<PressableProps, "style"> {
  /**
   * Static style (or array of styles). The pressed-state opacity callback
   * from Pressable is NOT supported — use this component for the spring
   * scale effect instead.
   */
  style?: StyleProp<ViewStyle>;
  /** Scale factor when pressed. Defaults to 0.96. */
  activeScale?: number;
  /** Fire a light haptic on press-in. Defaults to true. */
  haptic?: boolean;
}

export const AnimatedPressable = React.memo(function AnimatedPressable({
  style,
  activeScale = 0.96,
  haptic = true,
  children,
  ...rest
}: AnimatedPressableProps) {
  return (
    <MotionPressable
      {...rest}
      style={style}
      pressScale={activeScale}
      haptic={haptic}
      preset="fade"
    >
      {children}
    </MotionPressable>
  );
});
