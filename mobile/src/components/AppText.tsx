import * as React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { colors, typography } from "../theme/tokens";

type Variant = "heading" | "body" | "bodyMedium";

interface AppTextProps extends TextProps {
  variant?: Variant;
}

export function AppText({ variant = "body", style, ...props }: AppTextProps) {
  const baseStyle: TextStyle =
    variant === "heading"
      ? {
          fontFamily: typography.serif,
          color: colors.charcoal,
        }
      : variant === "bodyMedium"
        ? {
            fontFamily: typography.sansMedium,
            color: colors.charcoal,
          }
        : {
            fontFamily: typography.sans,
            color: colors.charcoal,
          };

  return <Text {...props} style={[baseStyle, style]} />;
}
