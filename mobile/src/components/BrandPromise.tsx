import * as React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon, type IconName } from "./Icon";
import { AppText as Text } from "./AppText";
import { colors, spacing, typography } from "../theme/tokens";

type PromiseItem = {
  icon: IconName;
  title: string;
  copy: string;
};

type BrandPromiseProps = {
  style?: StyleProp<ViewStyle>;
};

const PROMISE_ITEMS: PromiseItem[] = [
  {
    // Not a sparkle: craftsmanship is an award for human work, not a machine
    // flourish. Sparkles are reserved for the virtual try-on, which really is
    // generated — using the same mark for both muddles what the app is claiming.
    icon: "award",
    title: "Handcrafted",
    copy: "Premium fabrics, intricate finishes, and details that photograph beautifully.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Verified Sellers",
    copy: "Curated ateliers across India - every piece vetted for quality and authenticity.",
  },
  {
    icon: "cube-outline",
    title: "Pan-India Shipping",
    copy: "Fast, tracked delivery to every pincode with luxury packaging on arrival.",
  },
  {
    icon: "refresh-outline",
    title: "Easy 7-Day Returns",
    copy: "Try at home with confidence - return or exchange within a week, no questions.",
  },
];

export function BrandPromise({ style }: BrandPromiseProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.headingWrap}>
        <View style={styles.headingMark} />
        <Text style={styles.eyebrow}>The KTMONA Promise</Text>
        <View style={styles.headingMark} />
      </View>
      <Text style={styles.heading}>Why shop with us</Text>

      <View style={styles.grid}>
        {PROMISE_ITEMS.map((item) => (
          <View key={item.title} style={styles.card}>
            <View style={styles.iconWrap}>
              <Icon name={item.icon} size={22} color={colors.gold} />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardCopy} numberOfLines={3}>
              {item.copy}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.cream,
    gap: spacing.md,
  },
  headingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  headingMark: {
    width: 22,
    height: 1,
    backgroundColor: colors.gold,
  },
  eyebrow: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.gold,
    fontWeight: "700",
  },
  heading: {
    fontFamily: typography.serif,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.charcoal,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  card: {
    width: "47%",
    flexGrow: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: "rgba(184, 149, 108, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: typography.serif,
    fontSize: 15,
    fontWeight: "600",
    color: colors.charcoal,
    letterSpacing: 0.2,
  },
  cardCopy: {
    fontFamily: typography.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.brownSoft,
  },
});
