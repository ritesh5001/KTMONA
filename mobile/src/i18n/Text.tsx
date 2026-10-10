import * as React from "react";
import { Text as RNText, type TextProps } from "react-native";
import { translateChildren, useLanguage } from "./index";

/**
 * Drop-in replacement for React Native's `Text` that shows its string
 * children in the selected app language. Non-string children (numbers,
 * prices, nested elements) pass through untouched.
 */
export const Text = React.forwardRef<RNText, TextProps>(function Text({ children, ...props }, ref) {
  const { lang } = useLanguage();
  return (
    <RNText ref={ref} {...props}>
      {translateChildren(lang, children)}
    </RNText>
  );
});
