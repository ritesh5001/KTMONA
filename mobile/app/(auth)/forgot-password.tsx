import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, typography, radius } from "../../src/theme";
import { AppHeader } from "../../src/components/AppHeader";
import { forgotPassword } from "../../src/services/auth";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../src/components";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleContinue = React.useCallback(async () => {
    const trimmed = identifier.trim();
    const value = trimmed.includes("@") ? trimmed.toLowerCase() : trimmed.replace(/\D/g, "");
    if (!value || (!trimmed.includes("@") && !/^\d{10,15}$/.test(value))) {
      setError("Please enter your email address or mobile number.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await forgotPassword({ identifier: value });
      router.push({ pathname: "/(auth)/reset-password", params: { id: value } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset OTP");
    } finally {
      setLoading(false);
    }
  }, [identifier, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader showBack />
      <View style={styles.container}>
        <Text style={styles.heading}>Forgot password</Text>
        <Text style={styles.subHeading}>Enter your email or mobile number. We&apos;ll send an OTP to your registered email to reset your password.</Text>

        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="Email or mobile number"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.continueButton} onPress={handleContinue} disabled={loading}>
          <Text style={styles.continueText}>{loading ? "SENDING..." : "CONTINUE"}</Text>
        </Pressable>

        <Pressable style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backText}>Back to Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
  },
  heading: {
    fontFamily: typography.serif,
    fontSize: 32,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subHeading: {
    marginTop: spacing.sm,
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  continueButton: {
    marginTop: spacing.lg,
    width: "100%",
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryAccent,
  },
  continueText: {
    color: colors.white,
    fontFamily: typography.bodyMedium,
    letterSpacing: 1,
    fontSize: 13,
  },
  errorText: {
    marginTop: spacing.sm,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.primaryAccent,
    textAlign: "center",
  },
  backRow: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  backText: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.primaryAccent,
  },
});
