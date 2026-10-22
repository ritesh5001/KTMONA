/**
 * Guest checkout: shop without creating a password. The shopper gives a name and
 * email, verifies a one-time code, and is signed in to a light account (created on
 * the spot, or their existing one) so they can track the order. Opened from Add to
 * cart / Buy now when signed out; the item they tapped is added straight after.
 */

import * as React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../src/hooks/useAuth";
import { requestGuestOtp, type OtpVerifyWith } from "../src/services/auth";
import { addCartItem } from "../src/services/cart";
import { getAccessToken } from "../src/storage/auth";
import { useCart } from "../src/providers/CartProvider";
import { useToast } from "../src/providers/ToastProvider";
import { C, S } from "../src/ui/theme";
import { PrimaryBtn, ScreenHeader, T } from "../src/ui/kit";
import { useT } from "../src/i18n";

export default function GuestCheckoutScreen() {
  const router = useRouter();
  const t = useT();
  const { showToast } = useToast();
  const { signInWithOtp } = useAuth();
  const { refreshCart } = useCart();
  const params = useLocalSearchParams<{ productId?: string; variantId?: string; intent?: string }>();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [step, setStep] = React.useState<"details" | "code">("details");
  const [verifyWith, setVerifyWith] = React.useState<OtpVerifyWith | null>(null);
  const [existing, setExisting] = React.useState(false);
  const [otp, setOtp] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    const digits = phone.replace(/\D/g, "");
    if (name.trim().length < 2) return setError("Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (digits && !/^\d{10,15}$/.test(digits)) return setError("Mobile number must be 10 to 15 digits.");
    setBusy(true);
    try {
      const res = await requestGuestOtp({ fullName: name.trim(), email: email.trim(), ...(digits ? { phone: digits } : {}) });
      setVerifyWith(res.verifyWith ?? { email: email.trim().toLowerCase() });
      setExisting(res.existingAccount);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code from your email.");
    if (!verifyWith) return setStep("details");
    setBusy(true);
    try {
      const message = await signInWithOtp({ ...verifyWith, otp });
      if (message) {
        setError(message);
        return;
      }
      // Finish the action they started on the product page.
      if (params.productId && params.variantId) {
        const token = await getAccessToken();
        await addCartItem({ productId: params.productId, variantId: params.variantId, quantity: 1 }, token).catch(() => undefined);
        await refreshCart().catch(() => undefined);
      }
      showToast(t("You're signed in"), "success");
      if (params.intent === "buy" && params.variantId) {
        router.replace(`/checkout?buyNowVariantId=${encodeURIComponent(params.variantId)}`);
      } else if (params.productId) {
        router.replace("/cart");
      } else {
        router.back();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Continue as guest" actions={false} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: S.page, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <T size={14} color={C.textSoft}>
            {t("No password needed. We'll email you a one-time code so you can track your order.")}
          </T>

          {step === "details" ? (
            <>
              <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" />
              <Field label="Email" value={email} onChangeText={setEmail} autoComplete="email" keyboardType="email-address" autoCapitalize="none" />
              <Field label="Mobile number (optional)" value={phone} onChangeText={setPhone} autoComplete="tel" keyboardType="phone-pad" />
              {error ? <T size={12} color={C.red} style={{ marginTop: 10 }}>{error}</T> : null}
              <PrimaryBtn label="Send verification code" onPress={() => void sendCode()} loading={busy} style={{ marginTop: 18 }} />
            </>
          ) : (
            <>
              <T size={14} style={{ marginTop: 16 }}>
                {t("Enter the code sent to")} {"email" in (verifyWith ?? {}) ? (verifyWith as { email: string }).email : email}
              </T>
              {existing ? (
                <T size={12} color={C.muted} style={{ marginTop: 4 }}>
                  This email already has a KTMONA account, so your order will be added to it.
                </T>
              ) : null}
              <TextInput
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                style={[styles.input, styles.otp]}
                accessibilityLabel={t("Verification code")}
              />
              {error ? <T size={12} color={C.red} style={{ marginTop: 10 }}>{error}</T> : null}
              <PrimaryBtn label="Verify and continue" onPress={() => void verify()} loading={busy} style={{ marginTop: 18 }} />
              <View style={styles.row}>
                <Pressable onPress={() => setStep("details")} hitSlop={8}>
                  <T size={13} color={C.muted}>Change details</T>
                </Pressable>
                <Pressable onPress={() => void sendCode()} hitSlop={8} disabled={busy}>
                  <T w="semibold" size={13} color={C.brandDark}>Resend code</T>
                </Pressable>
              </View>
            </>
          )}

          <Pressable onPress={() => router.push("/login")} style={{ marginTop: 24, alignSelf: "center" }} hitSlop={8}>
            <T size={13} color={C.muted}>
              {t("Have an account?")} <T w="semibold" size={13} color={C.brandDark}>{t("Sign in")}</T>
            </T>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, ...input }: React.ComponentProps<typeof TextInput> & { label: string }) {
  const t = useT();
  return (
    <View style={{ marginTop: 14 }}>
      <T w="medium" size={13} color={C.textSoft}>{label}</T>
      <TextInput placeholderTextColor={C.faint} {...input} accessibilityLabel={t(label)} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.card,
  },
  otp: {
    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center",
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
});
