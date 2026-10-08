import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing, typography, radius } from "../../src/theme";
import { requestOtp } from "../../src/services/auth";
import { useAuth } from "../../src/hooks/useAuth";
import { AppHeader } from "../../src/components/AppHeader";
import { useSmsOtpAutofill, getSmsAppHash } from "../../src/hooks/useSmsOtpAutofill";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../src/components";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const { signInWithOtp } = useAuth();
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const submittedOtpRef = React.useRef<string | null>(null);

  const handleVerify = React.useCallback(async () => {
    const identifier = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
    const code = otp.trim();

    if (!identifier) {
      console.warn("[mobile-auth][verify-otp] missing phone");
      setError("Missing mobile number. Please request OTP again.");
      return;
    }
    if (code.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      console.info("[mobile-auth][verify-otp] submit", { phone: "[present]", otpLength: code.length });
      const responseMessage = await signInWithOtp({ phone: identifier, otp: code });
      if (responseMessage) {
        setMessage(responseMessage);
        return;
      }
      router.replace("/home");
    } catch (err) {
      console.error("[mobile-auth][verify-otp] failed", err);
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }, [phone, otp, signInWithOtp, router]);

  const handleResend = React.useCallback(async () => {
    const identifier = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
    if (!identifier) {
      console.warn("[mobile-auth][verify-otp] resend blocked - missing phone");
      setError(`Missing mobile number. Please request OTP again.`);
      return;
    }

    setResending(true);
    setError(null);
    setMessage(null);
    try {
      console.info("[mobile-auth][verify-otp] resend", { phone: "[present]" });
      const result = await requestOtp({ phone: identifier });
      setMessage(result.message || "OTP sent again.");
    } catch (err) {
      console.error("[mobile-auth][verify-otp] resend failed", err);
      setError(err instanceof Error ? err.message : "Could not resend OTP");
    } finally {
      setResending(false);
    }
  }, [phone]);

  // Read the code straight out of the incoming SMS (Android, no permission).
  // Combined with the auto-submit below this makes verification hands-free: the
  // message arrives, the field fills, and the code is submitted.
  useSmsOtpAutofill(
    React.useCallback((code: string) => {
      setOtp(code);
      setError(null);
    }, []),
    { enabled: !loading, length: 6 },
  );

  // Dev-only: the SMS Retriever app hash must be appended to the OTP message or
  // auto-read never fires. It depends on the signing key, so a debug build and a
  // Play-signed release produce DIFFERENT hashes — read it from the build you ship.
  const [smsAppHash, setSmsAppHash] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!__DEV__) return;
    void getSmsAppHash().then(setSmsAppHash);
  }, []);

  React.useEffect(() => {
    if (otp.length !== 6 || loading || submittedOtpRef.current === otp) {
      return;
    }
    submittedOtpRef.current = otp;
    void handleVerify();
  }, [handleVerify, loading, otp]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader showBack />
      <View style={styles.container}>
        <Text style={styles.heading}>Verify OTP</Text>
        <Text style={styles.subHeading}>
          Enter the 6-digit code sent to your mobile number
        </Text>

        {__DEV__ && smsAppHash ? (
          <Text style={styles.devHash} selectable>
            SMS app hash (dev build): {smsAppHash}
          </Text>
        ) : null}

        <TextInput
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="Enter OTP"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.infoText}>{message}</Text> : null}

        <Pressable style={styles.continueButton} onPress={handleVerify} disabled={loading}>
          <Text style={styles.continueText}>{loading ? "VERIFYING..." : "CONTINUE"}</Text>
        </Pressable>

        <Pressable style={styles.resendRow} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendText}>{resending ? "Resending..." : "Resend OTP"}</Text>
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
    fontFamily: typography.heading,
    fontSize: 30,
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
  devHash: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
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
    textAlign: "center",
    letterSpacing: 5,
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
  infoText: {
    marginTop: spacing.sm,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: "center",
  },
  resendRow: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  resendText: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.primaryAccent,
  },
});
