import React from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";

/**
 * Form field label with an optional required marker.
 *
 * Shared so every mandatory field across the app is marked the same way, matching
 * the red asterisk used on the website. The asterisk is decorative — it carries no
 * meaning for screen readers beyond the label text, so the label reads out as
 * "<name>, required" via accessibilityLabel rather than announcing "star".
 */
export function FieldLabel({
  children,
  required,
  style,
}: {
  children: React.ReactNode;
  required?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const text = typeof children === "string" ? children : undefined;

  return (
    <Text
      style={[styles.label, style]}
      accessibilityLabel={text && required ? `${text}, required` : undefined}
    >
      {children}
      {required ? (
        <Text style={styles.required} accessibilityElementsHidden>
          {" *"}
        </Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  required: {
    color: "#DC2626",
    fontWeight: "700",
  },
});
