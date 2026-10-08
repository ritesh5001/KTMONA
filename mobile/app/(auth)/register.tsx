import * as React from "react";
import { FieldLabel } from "../../src/components/FieldLabel";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { colors, radius, spacing, typography, shadow } from "../../src/theme/tokens";
import { registerUser } from "../../src/services/auth";
import { AppHeader } from "../../src/components/AppHeader";
import { ApiError } from "../../src/services/api";
import { BrandLoader } from "../../src/components/BrandLoader";
import { Icon } from "../../src/components/Icon";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../src/components";

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

const REGISTER_PLACEHOLDER_COLOR = "rgba(91, 78, 69, 0.48)";

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRegister = async () => {
    if (!fullName || !email || !phone || !password) {
      setError("Please fill all required fields.");
      return;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!/^\d{10,15}$/.test(normalizedPhone)) {
      setError("Mobile number must be 10 to 15 digits.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least 1 uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least 1 number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await registerUser({
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password,
      });
      router.replace({ pathname: "/(auth)/verify-otp", params: { method: "whatsapp", phone: normalizedPhone } });
    } catch (err) {
      const message =
        err instanceof ApiError && err.statusCode === 409
          ? "An account with this email or mobile number already exists"
          : err instanceof Error
            ? err.message
            : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader showBack />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Join curated fashion for every occasion.</Text>

        <View style={styles.accountBadge}>
          <Text style={styles.accountBadgeText}>Buyer account</Text>
        </View>

        <View style={styles.card}>
          <FieldLabel required>Full name</FieldLabel>
          <TextInput
            placeholder="Enter your name"
            placeholderTextColor={REGISTER_PLACEHOLDER_COLOR}
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
          />

          <FieldLabel required>Email</FieldLabel>
          <TextInput
            placeholder="you@example.com"
            placeholderTextColor={REGISTER_PLACEHOLDER_COLOR}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />

          <FieldLabel required>Mobile number</FieldLabel>
          <TextInput
            placeholder="9876543210"
            placeholderTextColor={REGISTER_PLACEHOLDER_COLOR}
            style={styles.input}
            value={phone}
            onChangeText={(value) => setPhone(value.replace(/\D/g, ""))}
            keyboardType="phone-pad"
          />
          <Text style={styles.helperText}>
            We&apos;ll send a verification code to this number by SMS.
          </Text>

          <FieldLabel required>Password</FieldLabel>
          <View style={styles.inputRow}>
            <TextInput
              placeholder="Create a password"
              placeholderTextColor={REGISTER_PLACEHOLDER_COLOR}
              secureTextEntry={!showPassword}
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              accessibilityState={{ expanded: showPassword }}
            >
              <Icon
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.brownSoft}
              />
            </Pressable>
          </View>
          <Text style={styles.helperText}>
            Use at least 8 characters, 1 uppercase letter, and 1 number.
          </Text>

          <FieldLabel required>Confirm password</FieldLabel>
          <View style={styles.inputRow}>
            <TextInput
              placeholder="Re-enter password"
              placeholderTextColor={REGISTER_PLACEHOLDER_COLOR}
              secureTextEntry={!showConfirmPassword}
              style={[styles.input, styles.passwordInput]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
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

          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <BrandLoader size="sm" color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Create account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/login" style={styles.footerLink}>
            Sign in
          </Link>
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
  },
  accountBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  accountBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 1.4,
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
  helperText: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
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
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
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
