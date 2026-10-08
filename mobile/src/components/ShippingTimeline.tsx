import * as React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography, radius } from "../theme/tokens";
import type { ShipmentStatus } from "../services/shipping";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
interface Step {
  key: ShipmentStatus;
  label: string;
}

const STEPS: Step[] = [
  { key: "CREATED", label: "Placed" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
];

const STATUS_INDEX: Record<ShipmentStatus, number> = {
  CREATED: 0,
  SHIPPED: 1,
  DELIVERED: 2,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ShippingTimelineProps {
  /** Current shipment status. */
  status: ShipmentStatus;
  /** Optional timestamp text below each completed step. */
  timestamps?: Partial<Record<ShipmentStatus, string | null>>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ShippingTimeline({ status, timestamps }: ShippingTimelineProps) {
  const activeIndex = STATUS_INDEX[status] ?? 0;
  const isFullyComplete = status === "DELIVERED";

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isCompleted = index <= activeIndex;
        const isCurrent = index === activeIndex;
        const isLast = index === STEPS.length - 1;
        const ts = timestamps?.[step.key];

        return (
          <View key={step.key} style={styles.stepRow}>
            {/* Dot + connector line */}
            <View style={styles.track}>
              <View
                style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  // Ring style only when current AND not fully complete
                  isCurrent && !isFullyComplete && styles.dotCurrent,
                ]}
              />
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    (isFullyComplete || index < activeIndex) &&
                      styles.lineCompleted,
                  ]}
                />
              )}
            </View>

            {/* Label + timestamp */}
            <View style={styles.content}>
              <Text
                style={[
                  styles.label,
                  isCompleted && styles.labelCompleted,
                  isCurrent && !isFullyComplete && styles.labelCurrent,
                ]}
              >
                {step.label}
              </Text>
              {ts ? (
                <Text style={styles.timestamp}>
                  {formatTimestamp(ts)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const DOT_SIZE = 14;
const LINE_WIDTH = 2;

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  track: {
    alignItems: "center",
    width: DOT_SIZE + spacing.sm * 2,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.pill,
    borderWidth: LINE_WIDTH,
    borderColor: colors.borderSoft,
    backgroundColor: colors.warmWhite,
  },
  dotCompleted: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  dotCurrent: {
    borderColor: colors.gold,
    backgroundColor: colors.warmWhite,
    borderWidth: 3,
  },
  line: {
    width: LINE_WIDTH,
    height: 32,
    backgroundColor: colors.borderSoft,
  },
  lineCompleted: {
    backgroundColor: colors.gold,
  },
  content: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.lg,
  },
  label: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.brownSoft,
  },
  labelCompleted: {
    color: colors.charcoal,
    fontFamily: typography.sansMedium,
  },
  labelCurrent: {
    color: colors.gold,
    fontFamily: typography.sansMedium,
  },
  timestamp: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
  },
});
