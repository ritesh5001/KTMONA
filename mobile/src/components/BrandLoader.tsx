import * as React from "react";
import { Animated, StyleSheet, View, Text } from "react-native";
import { colors, spacing, typography, radius } from "../theme/tokens";

interface BrandLoaderProps {
  label?: string;
  size?: "sm" | "md";
  color?: string;
}

export function BrandLoader({
  label,
  size = "md",
  color = colors.charcoal,
}: BrandLoaderProps) {
  const scale = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.8,
          duration: 450,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  const dotSize = size === "sm" ? 6 : 8;
  const gap = size === "sm" ? 6 : 8;

  return (
    <View style={styles.wrap}>
      <View style={[styles.dotRow, { gap }]}>
        <Animated.View
          style={[
            styles.dot,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
            { transform: [{ scale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
            { transform: [{ scale: scale.interpolate({ inputRange: [0.8, 1.2], outputRange: [1.1, 0.8] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
            { transform: [{ scale }] },
          ]}
        />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

export function BrandOverlayLoader({ label }: { label?: string }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <BrandLoader label={label ?? "Loading"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    opacity: 0.9,
  },
  label: {
    marginTop: spacing.sm,
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.brownSoft,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250, 247, 242, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  overlayCard: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
});
