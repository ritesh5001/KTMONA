import React from "react";
import { FieldLabel } from "../../src/components/FieldLabel";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing, typography, radius } from "../../src/theme";
import { AppHeader } from "../../src/components/AppHeader";
import { useAuth } from "../../src/hooks/useAuth";
import { requestOtp } from "../../src/services/auth";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../src/components";

function detectInputType(value: string): "phone" | "email" | "unknown" {
  const trimmed = value.trim();
  if (!trimmed) return "unknown";
  if (trimmed.includes("@")) return "email";
  if (/^[+\d][\d\s\-()+]*$/.test(trimmed)) return "phone";
  if (/[a-zA-Z]/.test(trimmed)) return "email";
  return "unknown";
}

export default function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { signIn } = useAuth();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [useOtp, setUseOtp] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const safeReturnTo = React.useMemo(() => {
    if (!returnTo || typeof returnTo !== "string") return "/home";
    if (!returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.includes("://")) {
      return "/home";
    }
    return returnTo;
  }, [returnTo]);

  const inputType = detectInputType(identifier);
  const identifierReady = inputType !== "unknown";
  const isOtpMode = useOtp && identifierReady;

  // Pick the method that fits what they typed: a mobile number defaults to SMS
  // OTP (they may well not have a password — accounts can be created via OTP),
  // an email defaults to password. Both toggles remain available below.
  React.useEffect(() => {
    setUseOtp(inputType === "phone");
    setPassword("");
    setError(null);
  }, [inputType]);

  const subHeading = isOtpMode
    ? "We'll send a one-time code to your mobile number."
    : identifierReady
      ? "Enter your password below."
      : "Enter your mobile number or email address to sign in.";

  const handleLogin = React.useCallback(async () => {
    const trimmed = inputType === "phone"
      ? identifier.trim()
      : identifier.trim().toLowerCase();

    if (!trimmed) {
      setError("Enter your mobile number or email address.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isOtpMode) {
        if (inputType !== "phone") {
          setError("OTP login requires a mobile number.");
          return;
        }

        const normalizedPhone = trimmed.replace(/\D/g, "");
        await requestOtp({ phone: normalizedPhone });
        router.push({ pathname: "/(auth)/verify-otp", params: { method: "whatsapp", phone: normalizedPhone } });
        return;
      }

      if (!password) {
        setError("Enter your password to continue.");
        return;
      }

      await signIn({ identifier: trimmed, password });
      router.replace(safeReturnTo as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [identifier, inputType, isOtpMode, password, signIn, router, safeReturnTo]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader showBack />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Welcome to KTMONA</Text>
        <Text style={styles.subHeading}>{subHeading}</Text>

        <View style={styles.formCard}>
          {/* Unified identifier input */}
          <FieldLabel required>
            {inputType === "phone"
              ? "Mobile Number"
              : inputType === "email"
                ? "Email Address"
                : "Mobile Number or Email"}
          </FieldLabel>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="9876543210 or you@example.com"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          {/* Password field – visible once identifier is detected and not in OTP mode */}
          {identifierReady && !isOtpMode && (
            <>
              <FieldLabel required>Password</FieldLabel>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Enter your password"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />
              {inputType === "phone" && (
                <Pressable onPress={() => setUseOtp(true)} style={styles.otpToggleRow}>
                  <Text style={styles.otpToggleText}>Login with SMS OTP instead</Text>
                </Pressable>
              )}
            </>
          )}

          {/* Switch back to password when in OTP mode */}
          {isOtpMode && (
            <Pressable onPress={() => setUseOtp(false)} style={styles.otpToggleRow}>
              <Text style={styles.otpToggleText}>Use password instead</Text>
            </Pressable>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable style={styles.continueButton} onPress={handleLogin} disabled={loading}>
            <Text style={styles.continueText}>
              {loading
                ? isOtpMode ? "SENDING OTP..." : "SIGNING IN..."
                : isOtpMode ? "SEND OTP" : "SIGN IN"}
            </Text>
          </Pressable>

          {!isOtpMode && (
            <View style={styles.linkRow}>
              <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                <Text style={styles.linkText}>Forgot Password?</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerCopy}>New to KTMONA?</Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.footerLink}>Create account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  heading: {
    fontFamily: typography.serif,
    fontSize: 38,
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  subHeading: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  formCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  label: {
    fontFamily: typography.sansMedium,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 10,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    marginBottom: spacing.lg,
  },
  otpToggleRow: {
    marginTop: -spacing.xs,
    marginBottom: spacing.lg,
    alignSelf: "flex-start",
  },
  otpToggleText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
    textDecorationLine: "underline",
    letterSpacing: 0.3,
  },
  continueButton: {
    marginTop: spacing.xs,
    width: "100%",
    height: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryAccent,
  },
  continueText: {
    color: colors.white,
    fontFamily: typography.bodyMedium,
    letterSpacing: 1.5,
    fontSize: 12,
  },
  errorText: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    fontFamily: typography.sans,
    color: colors.primaryAccent,
    fontSize: 12,
  },
  linkRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  linkText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    textDecorationLine: "underline",
  },
  footerRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
  },
  footerCopy: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  footerLink: {
    color: colors.primaryAccent,
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
