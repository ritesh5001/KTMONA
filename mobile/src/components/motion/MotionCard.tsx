import * as React from "react";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { MotionPressable } from "./MotionPressable";

export interface MotionCardProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
  haptic?: boolean;
  enterDelay?: number;
}

export const MotionCard = React.memo(function MotionCard({
  children,
  style,
  pressScale = 0.985,
  haptic = false,
  enterDelay = 0,
  ...rest
}: MotionCardProps) {
  return (
    <MotionPressable
      {...rest}
      style={style}
      pressScale={pressScale}
      haptic={haptic}
      preset="slideUp"
      enterDelay={enterDelay}
    >
      {children}
    </MotionPressable>
  );
});
