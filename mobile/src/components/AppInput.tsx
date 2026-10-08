import * as React from "react";
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextInput as NativeTextInput,
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

export const AppInput = React.forwardRef<NativeTextInput, TextInputProps>(
  (
    {
      style,
      placeholderTextColor,
      accessibilityLabel,
      accessibilityState,
      editable = true,
      onFocus,
      onBlur,
      placeholder,
      ...props
    },
    ref
  ) => {
    const [focused, setFocused] = React.useState(false);

    return (
      <TextInput
        ref={ref}
        {...props}
        placeholder={placeholder}
        editable={editable}
        accessibilityLabel={
          accessibilityLabel ??
          (typeof placeholder === "string" ? placeholder : undefined)
        }
        accessibilityState={{
          ...accessibilityState,
          disabled: !editable || accessibilityState?.disabled,
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          !editable && styles.inputDisabled,
          style,
        ]}
        placeholderTextColor={placeholderTextColor ?? colors.brownSoft}
        selectionColor={colors.interactive}
        allowFontScaling
      />
    );
  }
);

AppInput.displayName = "AppInput";

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: typography.sans,
    fontSize: 16,
    lineHeight: 22,
    color: colors.charcoal,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: colors.interactive,
    paddingHorizontal: spacing.md - 1,
    paddingVertical: 11,
  },
  inputDisabled: {
    opacity: 0.58,
    backgroundColor: colors.surface,
  },
});
