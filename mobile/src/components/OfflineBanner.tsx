import * as React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme/tokens";

// ---------------------------------------------------------------------------
// OfflineBanner — shows a subtle top banner when the device is offline
// ---------------------------------------------------------------------------
export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <View style={styles.banner} pointerEvents="none">
      <Text style={styles.text}>You are offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: colors.charcoal,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: spacing.xs,
    zIndex: 9999,
  },
  text: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.warmWhite,
    textTransform: "uppercase",
  },
});
