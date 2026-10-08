import * as React from "react";
import { FieldLabel } from "../../src/components/FieldLabel";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  type NativeSyntheticEvent,
  type TextInput as NativeTextInput,
  type TextInputKeyPressEventData,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  colors,
  radius,
  spacing,
  typography,
  shadow,
} from "../../src/theme/tokens";
import { resetPassword, forgotPassword } from "../../src/services/auth";
import { AppHeader } from "../../src/components/AppHeader";
import { Icon } from "../../src/components/Icon";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../src/components";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [digits, setDigits] = React.useState<string[]>(
    Array(OTP_LENGTH).fill("")
  );
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [countdown, setCountdown] = React.useState(RESEND_COOLDOWN_SECONDS);

  const inputRefs = React.useRef<(NativeTextInput | null)[]>([]);
  const passwordRef = React.useRef<NativeTextInput>(null);

  // ---------- Countdown timer ----------
  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // ---------- Auto-focus first OTP field ----------
  React.useEffect(() => {
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  // ---------- OTP input handlers ----------
  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (digit && index === OTP_LENGTH - 1) {
      // Last digit filled → move to password
      passwordRef.current?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
    }
  };

  const handlePaste = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, OTP_LENGTH).split("");
      setDigits((prev) => {
        const next = [...prev];
        chars.forEach((ch, i) => {
          if (index + i < OTP_LENGTH) next[index + i] = ch;
        });
        return next;
      });
      const focusIdx = Math.min(index + chars.length, OTP_LENGTH - 1);
      if (index + chars.length >= OTP_LENGTH) {
        passwordRef.current?.focus();
      } else {
        inputRefs.current[focusIdx]?.focus();
      }
      return true;
    }
    return false;
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    if (!phone) {
      setError("Missing mobile number. Please go back and try again.");
      return;
    }

    const otp = digits.join("");
    if (otp.length !== OTP_LENGTH) {
      setError("Please enter the full 6-digit OTP.");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await resetPassword({ phone, otp, newPassword });
      setSuccess(result.message);
      // Navigate to login after short delay
      setTimeout(() => router.replace("/(auth)/login"), 1500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Password reset failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Resend ----------
  const handleResend = async () => {
    if (countdown > 0 || !phone) return;
    setError(null);
    try {
      await forgotPassword({ phone });
      setCountdown(RESEND_COOLDOWN_SECONDS);
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to resend OTP";
      setError(message);
    }
  };

  const otpComplete = digits.every((d) => d !== "");

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader showBack />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{" "}
          <Text style={styles.emailHighlight}>{phone ?? "your mobile number"}</Text>
          {" "}and set a new password.
        </Text>

        <View style={styles.card}>
          {/* OTP digits */}
          <FieldLabel required>OTP Code</FieldLabel>
          <View style={styles.otpRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => {
                  inputRefs.current[i] = ref;
                }}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : null,
                ]}
                value={digit}
                onChangeText={(text) => {
                  if (!handlePaste(text, i)) {
                    handleChange(text, i);
                  }
                }}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                // The first box accepts the whole code so SMS autofill and paste
                // actually work: with maxLength={1} the OS delivered six digits and
                // the field kept one, so handlePaste() never saw a full code. It
                // distributes the digits across the boxes from here.
                maxLength={i === 0 ? OTP_LENGTH : 1}
                // Platform autofill hints — iOS surfaces the code above the
                // keyboard, Android offers it through the autofill framework.
                textContentType={i === 0 ? "oneTimeCode" : "none"}
                autoComplete={i === 0 ? "sms-otp" : "off"}
                importantForAutofill={i === 0 ? "yes" : "no"}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </View>

          {/* New password */}
          <FieldLabel required>New Password</FieldLabel>
          <View style={styles.inputRow}>
            <TextInput
              ref={passwordRef}
              placeholder="Min 8 characters"
              placeholderTextColor={colors.brownSoft}
              secureTextEntry={!showNewPassword}
              style={[styles.input, styles.passwordInput]}
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!loading}
              autoComplete="new-password"
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowNewPassword((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showNewPassword ? "Hide new password" : "Show new password"}
              accessibilityState={{ expanded: showNewPassword }}
            >
              <Icon
                name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.brownSoft}
              />
            </Pressable>
          </View>

          {/* Confirm password */}
          <FieldLabel required>Confirm Password</FieldLabel>
          <View style={styles.inputRow}>
            <TextInput
              placeholder="Re-enter password"
              placeholderTextColor={colors.brownSoft}
              secureTextEntry={!showConfirmPassword}
              style={[styles.input, styles.passwordInput]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
              accessibilityState={{ expanded: showConfirmPassword }}
            >
              <Icon
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.brownSoft}
              />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <Pressable
            style={[
              styles.primaryButton,
              (loading || !otpComplete) && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || !otpComplete}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Resetting…" : "Reset Password"}
            </Text>
          </Pressable>

          {/* Resend row */}
          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={styles.resendTimer}>
                Resend code in {countdown}s
              </Text>
            ) : (
              <Pressable onPress={handleResend}>
                <Text style={styles.resendLink}>Resend code</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Wrong number?</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.footerLink}>Go back</Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardWrap: {
    flex: 1,
  },
  container: {
    padding: spacing.lg,
  },
  title: {
    fontFamily: typography.serif,
    fontSize: 28,
    color: colors.charcoal,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 14,
    color: colors.brownSoft,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  emailHighlight: {
    fontFamily: typography.sansMedium,
    color: colors.charcoal,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.brown,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    marginBottom: spacing.xs,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  otpInput: {
    width: 46,
    height: 54,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    textAlign: "center",
    fontFamily: typography.sansMedium,
    fontSize: 22,
    color: colors.charcoal,
    backgroundColor: colors.surface,
  },
  otpInputFilled: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceElevated,
  },
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    fontFamily: typography.sans,
    color: colors.charcoal,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  inputRow: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 46,
  },
  eyeButton: {
    position: "absolute",
    right: spacing.sm,
    top: 8,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.background,
  },
  errorText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gold,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  successText: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.gold,
    marginBottom: spacing.sm,
    textAlign: "center",
    lineHeight: 19,
  },
  resendRow: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  resendTimer: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },
  resendLink: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.gold,
  },
  footerRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
  },
  footerText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },
  footerLink: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.gold,
  },
});
