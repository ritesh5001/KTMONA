import * as React from "react";
import { View, StyleSheet, Animated, type ViewStyle } from "react-native";
import { colors, spacing, radius } from "../theme/tokens";

// ---------------------------------------------------------------------------
// Pulse animation hook (shared across all skeleton instances)
// ---------------------------------------------------------------------------
const sharedPulseOpacity = new Animated.Value(0.18);
let sharedPulseLoop: Animated.CompositeAnimation | null = null;
let sharedPulseUsers = 0;

function startSharedPulseLoop() {
  if (sharedPulseLoop) return;

  sharedPulseLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(sharedPulseOpacity, {
        toValue: 0.42,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(sharedPulseOpacity, {
        toValue: 0.18,
        duration: 800,
        useNativeDriver: true,
      }),
    ])
  );

  sharedPulseLoop.start();
}

function stopSharedPulseLoop() {
  if (!sharedPulseLoop) return;
  sharedPulseLoop.stop();
  sharedPulseLoop = null;
  sharedPulseOpacity.setValue(0.18);
}

function usePulse(): Animated.Value {
  React.useEffect(() => {
    sharedPulseUsers += 1;
    startSharedPulseLoop();

    return () => {
      sharedPulseUsers -= 1;
      if (sharedPulseUsers <= 0) {
        sharedPulseUsers = 0;
        stopSharedPulseLoop();
      }
    };
  }, []);

  return sharedPulseOpacity;
}

// ---------------------------------------------------------------------------
// Base skeleton block
// ---------------------------------------------------------------------------
interface SkeletonBlockProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBlock(props: SkeletonBlockProps) {
  const w = props.width ?? "100%";
  const isPercentWidth = typeof w === "string" && w.endsWith("%");
  const normalizedWidth =
    typeof w === "number" || w === "auto" || isPercentWidth ? w : "100%";
  const h = props.height ?? 12;
  const borderRadius = props.borderRadius ?? 0;
  const style = props.style;
  const opacity = usePulse();
  return (
    <Animated.View
      style={[
        {
          width: normalizedWidth as ViewStyle["width"],
          height: h,
          borderRadius,
          backgroundColor: colors.brown,
          opacity,
        },
        style,
      ]}
    />
  );
}

type SkeletonProductCardProps = {
  width?: number;
};

// ---------------------------------------------------------------------------
// SkeletonProductCard — 2-column grid card (search screen)
// ---------------------------------------------------------------------------
export const SkeletonProductCard = React.memo(function SkeletonProductCard(
  props: SkeletonProductCardProps
) {
  const w = props.width;
  const opacity = usePulse();
  return (
    <View style={[styles.productCard, w != null && { width: w }]}>
      <Animated.View
        style={[styles.productImage, { opacity, backgroundColor: colors.brown }]}
      />
      <Animated.View
        style={[styles.line, { opacity, marginTop: spacing.sm }]}
      />
      <Animated.View
        style={[styles.lineShort, { opacity, marginTop: spacing.xs }]}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------
// SkeletonOrderRow — order list card
// ---------------------------------------------------------------------------
export const SkeletonOrderRow = React.memo(function SkeletonOrderRow() {
  const opacity = usePulse();
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Animated.View style={[styles.orderTitleLine, { opacity }]} />
        <Animated.View style={[styles.orderBadge, { opacity }]} />
      </View>
      <Animated.View
        style={[styles.lineShort, { opacity, marginTop: spacing.xs }]}
      />
      <Animated.View
        style={[styles.orderPriceLine, { opacity, marginTop: spacing.sm }]}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------
// SkeletonNotificationRow — notification list card
// ---------------------------------------------------------------------------
export const SkeletonNotificationRow = React.memo(
  function SkeletonNotificationRow() {
    const opacity = usePulse();
    return (
      <View style={styles.notifCard}>
        <Animated.View style={[styles.line, { opacity }]} />
        <Animated.View
          style={[styles.notifMessage, { opacity, marginTop: spacing.xs }]}
        />
        <Animated.View
          style={[styles.notifDate, { opacity, marginTop: spacing.sm }]}
        />
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// SkeletonCartRow — cart item card
// ---------------------------------------------------------------------------
export const SkeletonCartRow = React.memo(function SkeletonCartRow() {
  const opacity = usePulse();
  return (
    <View style={styles.cartCard}>
      <Animated.View style={[styles.line, { opacity }]} />
      <Animated.View
        style={[styles.lineShort, { opacity, marginTop: spacing.xs }]}
      />
      <Animated.View
        style={[styles.orderPriceLine, { opacity, marginTop: spacing.sm }]}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  // Product card skeleton
  productCard: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  productImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.brown,
  },
  line: {
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: colors.brown,
  },
  lineShort: {
    height: 12,
    width: "60%",
    borderRadius: radius.xs,
    backgroundColor: colors.brown,
  },

  // Order card skeleton
  orderCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderTitleLine: {
    height: 14,
    width: "50%",
    borderRadius: radius.xs,
    backgroundColor: colors.brown,
  },
  orderBadge: {
    height: 10,
    width: 70,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  orderPriceLine: {
    height: 12,
    width: "30%",
    borderRadius: radius.xs,
    backgroundColor: colors.brown,
  },

  // Notification card skeleton
  notifCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  notifMessage: {
    height: 12,
    width: "90%",
    borderRadius: radius.xs,
    backgroundColor: colors.brown,
  },
  notifDate: {
    height: 10,
    width: "25%",
    borderRadius: radius.xs,
    backgroundColor: colors.gold,
  },

  // Cart card skeleton
  cartCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
});
