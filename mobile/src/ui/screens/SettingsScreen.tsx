import * as React from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../providers/ToastProvider";
import { useT } from "../../i18n";
import { C, S } from "../theme";
import { EmptyState, PrimaryBtn, ScreenHeader, T } from "../kit";
import {
  cancelAccountDeletion,
  getDeletionRequest,
  getNotificationPreferences,
  listSavedPaymentMethods,
  removeSavedPaymentMethod,
  requestAccountDeletion,
  updateNotificationPreferences,
  type DeletionRequest,
  type NotificationPreferences,
  type SavedPaymentMethod,
} from "../../services/account";

/** Account → Settings & Privacy: notification consent, saved payments, deletion. */
export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  if (!session?.accessToken) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Settings & Privacy" />
        <EmptyState title="Sign in to continue" action={<PrimaryBtn label="Sign Up / Log In" onPress={() => router.push("/login")} style={{ marginTop: 10 }} />} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Settings & Privacy" />
      <ScrollView contentContainerStyle={{ padding: S.page, paddingBottom: 40 }}>
        <Notifications />
        <SavedPayments />
        <Privacy />
      </ScrollView>
    </View>
  );
}

function Section({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <View style={styles.card}>
      <T w="semibold" size={15}>{t(title)}</T>
      <T size={12} color={C.muted} style={{ marginTop: 2, marginBottom: 10 }}>{t(text)}</T>
      {children}
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <T w="medium" size={14}>{t(label)}</T>
        <T size={11} color={C.muted}>{t(hint)}</T>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.green, false: C.border }} accessibilityLabel={t(label)} />
    </View>
  );
}

function Notifications() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = React.useState<NotificationPreferences | null>(null);
  React.useEffect(() => {
    getNotificationPreferences().then(setPrefs).catch(() => undefined);
  }, []);
  const save = async (patch: Partial<Omit<NotificationPreferences, "available">>) => {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      setPrefs(await updateNotificationPreferences(patch));
    } catch (err) {
      setPrefs(before);
      showToast(err instanceof Error ? err.message : "Could not save", "error");
    }
  };
  const later = "We'll start sending these once the service is live. Your choice is saved.";
  return (
    <Section title="Notification preferences" text="Order, shipping and delivery updates always appear in Notifications. Choose where else we send them.">
      {!prefs ? (
        <ActivityIndicator color={C.brand} />
      ) : (
        <>
          <ToggleRow label="Email" hint="Shipping, delivery and return updates. Order confirmations are always emailed." value={prefs.email} onChange={(v) => void save({ email: v })} />
          <ToggleRow label="SMS" hint={prefs.available.sms ? "Updates by text message." : later} value={prefs.sms} onChange={(v) => void save({ sms: v })} />
          <ToggleRow label="WhatsApp" hint={prefs.available.whatsapp ? "Updates on WhatsApp." : later} value={prefs.whatsapp} onChange={(v) => void save({ whatsapp: v })} />
          <ToggleRow label="Offers and promotions" hint="Sales, coupons and new arrivals." value={prefs.marketing} onChange={(v) => void save({ marketing: v })} />
        </>
      )}
    </Section>
  );
}

function SavedPayments() {
  const t = useT();
  const { showToast } = useToast();
  const [methods, setMethods] = React.useState<SavedPaymentMethod[] | null>(null);
  const load = React.useCallback(() => {
    listSavedPaymentMethods()
      .then((r) => setMethods(r.methods))
      .catch(() => setMethods([]));
  }, []);
  React.useEffect(load, [load]);
  const remove = (m: SavedPaymentMethod) =>
    Alert.alert(t("Remove this payment method?"), m.label, [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Remove"),
        style: "destructive",
        onPress: () =>
          void removeSavedPaymentMethod(m.id)
            .then(() => {
              showToast(t("Payment method removed"), "success");
              load();
            })
            .catch((err) => showToast(err instanceof Error ? err.message : "Could not remove it", "error")),
      },
    ]);
  return (
    <Section title="Saved payment methods" text="Cards and UPI IDs you saved in the Razorpay payment window. KTMONA never stores your card number — Razorpay keeps a secure token.">
      {!methods ? (
        <ActivityIndicator color={C.brand} />
      ) : methods.length === 0 ? (
        <T size={12} color={C.muted}>{t("No saved methods yet. Choose to save your card or UPI ID when you pay to use it faster next time.")}</T>
      ) : (
        methods.map((m) => (
          <View key={m.id} style={styles.payRow}>
            <Feather name={m.method === "upi" ? "smartphone" : "credit-card"} size={18} color={C.muted} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <T w="medium" size={14}>{m.label}</T>
              {m.detail || m.expired ? <T size={11} color={C.muted}>{[m.detail, m.expired ? t("Expired") : null].filter(Boolean).join(" · ")}</T> : null}
            </View>
            <Pressable onPress={() => remove(m)} hitSlop={8} accessibilityLabel={t("Remove")}>
              <Feather name="trash-2" size={17} color={C.faint} />
            </Pressable>
          </View>
        ))
      )}
    </Section>
  );
}

function Privacy() {
  const t = useT();
  const router = useRouter();
  const { showToast } = useToast();
  const [request, setRequest] = React.useState<DeletionRequest | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    getDeletionRequest().then(setRequest).catch(() => setRequest({ requested: false, requestedAt: null, reason: null }));
  }, []);
  const submit = async () => {
    setBusy(true);
    try {
      setRequest(await requestAccountDeletion(reason));
      setConfirming(false);
      showToast(t("Deletion requested. We'll email you when it's done."), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send the request", "error");
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    setBusy(true);
    try {
      setRequest(await cancelAccountDeletion());
      showToast(t("Your account will stay open."), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not withdraw the request", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Privacy & account" text="How we use your data, and how to close your account.">
      <Pressable onPress={() => router.push("/privacy-policy")} style={styles.linkRow}>
        <T w="medium" size={14} color={C.brandDark}>{t("Read our Privacy Policy")}</T>
      </Pressable>
      <Pressable onPress={() => router.push("/support")} style={styles.linkRow}>
        <T w="medium" size={14} color={C.brandDark}>{t("Ask for a copy of your data")}</T>
      </Pressable>
      {!request ? null : request.requested ? (
        <View style={[styles.notice, { backgroundColor: "#FFFBEB" }]}>
          <T w="semibold" size={13} color="#92400E">{t("Account deletion requested")}</T>
          <T size={12} color="#92400E">{t("Our team will delete your account after open orders, returns and refunds are settled. Invoices are kept as required by tax law.")}</T>
          <PrimaryBtn label="Keep my account" variant="outline" onPress={() => void withdraw()} loading={busy} style={{ marginTop: 8 }} />
        </View>
      ) : confirming ? (
        <View style={[styles.notice, { backgroundColor: "#FEF2F2" }]}>
          <T w="semibold" size={13} color={C.red}>{t("Delete your KTMONA account?")}</T>
          <T size={12} color={C.text}>• {t("Your profile, addresses, wishlist and saved cart will be removed.")}</T>
          <T size={12} color={C.text}>• {t("Open orders, returns and refunds are completed first.")}</T>
          <T size={12} color={C.text}>• {t("Invoices are kept as required by tax law.")}</T>
          <TextInput value={reason} onChangeText={setReason} multiline maxLength={500} placeholder={t("Why are you leaving? (optional)")} placeholderTextColor={C.faint} style={styles.textArea} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <PrimaryBtn label="Cancel" variant="outline" onPress={() => setConfirming(false)} style={{ flex: 1 }} />
            <PrimaryBtn label="Request deletion" onPress={() => void submit()} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setConfirming(true)} style={[styles.linkRow, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
          <Feather name="trash-2" size={15} color={C.red} />
          <T w="medium" size={14} color={C.red}>{t("Delete my account")}</T>
        </Pressable>
      )}
      <Pressable onPress={() => void Linking.openURL("mailto:support@ktmona.in")} hitSlop={6} style={{ marginTop: 8 }}>
        <T size={11} color={C.muted}>support@ktmona.in</T>
      </Pressable>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider },
  payRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider },
  linkRow: { paddingVertical: 10 },
  notice: { borderRadius: 10, padding: 12, gap: 4, marginTop: 6 },
  textArea: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, minHeight: 60, marginTop: 8, color: C.text, textAlignVertical: "top", backgroundColor: C.card },
});
