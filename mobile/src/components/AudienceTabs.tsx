import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing, typography } from "../theme/tokens";

export type Audience = "MENS" | "KIDS";

interface AudienceTabsProps {
  value: Audience;
  onChange: (next: Audience) => void;
}

export function AudienceTabs({ value, onChange }: AudienceTabsProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="tablist"
      accessibilityLabel="Shop by audience"
    >
      {(["MENS", "KIDS"] as const).map((opt) => {
        const active = value === opt;
        const label = opt === "MENS" ? "Men" : "Kids";
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityHint={`Shows ${label.toLowerCase()} collection`}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && styles.tabPressed,
            ]}
          >
            <AppText style={[styles.label, active && styles.labelActive]}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    minWidth: 104,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: colors.interactive,
  },
  tabPressed: {
    opacity: 0.78,
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.5,
    color: colors.brownSoft,
  },
  labelActive: {
    color: colors.onAccent,
  },
});
