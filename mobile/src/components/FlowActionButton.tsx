import * as React from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Icon, type IconName } from "./Icon";
import { colors, radius, typography } from "../theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface FlowActionButtonProps {
  label: string;
  accessibilityLabel: string;
  icon: IconName;
  filled?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Shared commerce action used by cards, product detail and quick-buy. */
export function FlowActionButton({
  label,
  accessibilityLabel,
  icon,
  filled = false,
  disabled = false,
  onPress,
  style,
}: FlowActionButtonProps) {
  const progress = useSharedValue(0);

  const buttonMotion = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.965]) }],
  }));
  const fillMotion = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.15, 15]) }],
  }));
  const idleMotion = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, 12]) }],
  }));
  const activeMotion = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-10, 0]) }],
  }));
  const leadingIconMotion = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-40, 0]) }],
  }));

  const handlePressIn = React.useCallback(() => {
    if (!disabled) progress.value = withTiming(1, { duration: 300 });
  }, [disabled, progress]);
  const handlePressOut = React.useCallback(() => {
    progress.value = withDelay(
      140,
      withSpring(0, { damping: 16, stiffness: 190, mass: 0.65 })
    );
  }, [progress]);

  const idleColor = filled ? colors.warmWhite : colors.charcoal;

  return (
    <AnimatedPressable
      style={[
        styles.button,
        filled ? styles.filled : styles.outline,
        disabled && styles.disabled,
        style,
        buttonMotion,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fill,
          { backgroundColor: filled ? colors.gold : colors.charcoal },
          fillMotion,
        ]}
      />
      <Animated.View pointerEvents="none" style={[styles.leadingIcon, leadingIconMotion]}>
        <Icon name={icon} size={13} color={colors.warmWhite} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.idleContent, idleMotion]}>
        <Icon name={icon} size={12} color={idleColor} />
        <Animated.Text style={[styles.label, { color: idleColor }]}>
          {label}
        </Animated.Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.activeContent, activeMotion]}>
        <Animated.Text style={[styles.label, styles.activeLabel]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  filled: {
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  disabled: { opacity: 0.48 },
  fill: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  idleContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  activeContent: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  activeLabel: { color: colors.warmWhite },
  leadingIcon: {
    position: "absolute",
    left: 14,
    zIndex: 2,
  },
});
