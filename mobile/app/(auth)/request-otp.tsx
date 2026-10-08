import * as React from "react";
import { FieldLabel } from "../../src/components/FieldLabel";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import {
  colors,
  radius,
  spacing,
  typography,
  shadow,
} from "../../src/theme/tokens";
import { requestOtp } from "../../src/services/auth";
import { AppHeader } from "../../src/components/AppHeader";
import { BrandLoader } from "../../src/components/BrandLoader";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../src/components";

export default function RequestOtpScreen() {
  const router = useRouter();
  const [phone, setPhone] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRequestOtp = async () => {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(normalizedPhone)) {
      setError("Please enter a valid mobile number.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestOtp({ phone: normalizedPhone });
      router.push({ pathname: "/(auth)/verify-otp", params: { method: "whatsapp", phone: normalizedPhone } });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send OTP";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader showBack />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Sign in with OTP</Text>
        <Text style={styles.subtitle}>
          We&apos;ll send a one-time code to your mobile number.
        </Text>

        <View style={styles.card}>
          <FieldLabel required>Mobile number</FieldLabel>
          <TextInput
            placeholder="9876543210"
            placeholderTextColor={colors.brownSoft}
            style={styles.input}
            value={phone}
            onChangeText={(value) => setPhone(value.replace(/\D/g, ""))}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoComplete="tel"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleRequestOtp}
            editable={!loading}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleRequestOtp}
            disabled={loading}
          >
            {loading ? (
              <BrandLoader size="sm" color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Send OTP</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Prefer password?</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.footerLink}>Sign in with password</Text>
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
