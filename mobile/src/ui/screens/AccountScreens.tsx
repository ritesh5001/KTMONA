import * as React from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather, Ionicons } from "@expo/vector-icons";
import { CachedImage } from "../../components/CachedImage";
import { useToast } from "../../providers/ToastProvider";
import { useAuth } from "../../hooks/useAuth";
import { C, F, FILL, S, inr } from "../theme";
import { EmptyState, PrimaryBtn, ScreenHeader, T } from "../kit";
import { LANGUAGES, useLanguage, useT } from "../../i18n";
import { clearList, forgetProduct, useSavedProducts, type SavedProduct } from "../../lib/local-lists";
import { ShareSheet } from "../sheets";
import {
  cancelAppointment,
  deleteRefundDetails,
  getMyFullProfile,
  getRefundDetails,
  listMyAppointments,
  saveRefundDetails,
  updateMyProfile,
  type Appointment,
  type Gender,
} from "../../services/extras";

/* ── Shared bits ────────────────────────────────────────────────────────── */

function Field({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const t = useT();
  return (
    <View style={{ marginTop: 14 }}>
      <T w="medium" size={13} color={C.textSoft}>{label}</T>
      <TextInput
        placeholderTextColor={C.faint}
        {...input}
        placeholder={input.placeholder ? t(input.placeholder) : undefined}
        style={[styles.input, error ? { borderColor: C.red } : null, input.editable === false && { backgroundColor: C.bg, color: C.muted }]}
      />
      {error ? <T size={11} color={C.red} style={{ marginTop: 4 }}>{error}</T> : hint ? <T size={11} color={C.faint} style={{ marginTop: 4 }}>{hint}</T> : null}
    </View>
  );
}

function SignInPrompt() {
  const router = useRouter();
  return <EmptyState title="Sign in to continue" action={<PrimaryBtn label="Sign Up / Log In" onPress={() => router.push("/login")} style={{ marginTop: 10 }} />} />;
}

/* ── Edit profile ───────────────────────────────────────────────────────── */

const GENDERS: { key: Gender; label: string }[] = [
  { key: "FEMALE", label: "Female" },
  { key: "MALE", label: "Male" },
  { key: "OTHER", label: "Other" },
];

export function EditProfileScreen() {
  const router = useRouter();
  const t = useT();
  const { showToast } = useToast();
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me", "profile"], queryFn: ({ signal }) => getMyFullProfile(signal), enabled: Boolean(session) });
  const [name, setName] = React.useState("");
  const [gender, setGender] = React.useState<Gender | null>(null);
  const [dob, setDob] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!q.data) return;
    setName(q.data.fullName ?? "");
    setGender(q.data.gender);
    setDob(q.data.dob ? q.data.dob.split("-").reverse().join("/") : "");
  }, [q.data]);

  if (!session) return <View style={{ flex: 1, backgroundColor: C.bg }}><ScreenHeader title="Edit Profile" /><SignInPrompt /></View>;

  // DD/MM/YYYY typed by the shopper → YYYY-MM-DD for the API.
  const dobIso = (() => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob.trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  })();
  const dobError = dob.trim() && !dobIso ? t("Use DD/MM/YYYY") : null;

  const save = async () => {
    if (name.trim().length < 2) {
      showToast(t("Enter your name"), "info");
      return;
    }
    if (dobError) return;
    setSaving(true);
    try {
      await updateMyProfile({ fullName: name.trim(), gender, dob: dob.trim() ? dobIso : null });
      await qc.invalidateQueries({ queryKey: ["me", "profile"] });
      showToast(t("Profile updated"), "success");
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("Could not save"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Edit Profile" />
      {q.isLoading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
            <Field label="Mobile number" value={q.data?.phone ?? ""} editable={false} hint="Contact support to change your mobile number." />
            <Field label="Email" value={q.data?.email ?? ""} editable={false} />
            <T w="medium" size={13} color={C.textSoft} style={{ marginTop: 14 }}>Gender</T>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {GENDERS.map((g) => {
                const on = gender === g.key;
                return (
                  <Pressable key={g.key} onPress={() => setGender(on ? null : g.key)} style={[styles.chip, on && styles.chipOn]}>
                    <T size={13} w={on ? "semibold" : "regular"} color={on ? C.navy : C.text}>{g.label}</T>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Date of birth" value={dob} onChangeText={setDob} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" maxLength={10} error={dobError} />
          </View>
          <PrimaryBtn label="Save changes" loading={saving} onPress={() => void save()} style={{ marginTop: 16 }} />
        </ScrollView>
      )}
    </View>
  );
}

/* ── Bank & UPI details for refunds ────────────────────────────────────── */

export function RefundDetailsScreen() {
  const t = useT();
  const { showToast } = useToast();
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me", "refund-details"], queryFn: ({ signal }) => getRefundDetails(signal), enabled: Boolean(session) });
  const [method, setMethod] = React.useState<"UPI" | "BANK">("UPI");
  const [editing, setEditing] = React.useState(false);
  const [upi, setUpi] = React.useState("");
  const [holder, setHolder] = React.useState("");
  const [account, setAccount] = React.useState("");
  const [confirmAccount, setConfirmAccount] = React.useState("");
  const [ifsc, setIfsc] = React.useState("");
  const [bank, setBank] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  if (!session) return <View style={{ flex: 1, backgroundColor: C.bg }}><ScreenHeader title="Bank & UPI Details" /><SignInPrompt /></View>;

  const saved = q.data;
  const showForm = editing || (!q.isLoading && !saved);

  const save = async () => {
    if (method === "BANK" && account !== confirmAccount) {
      showToast(t("Account numbers do not match"), "info");
      return;
    }
    setSaving(true);
    try {
      await saveRefundDetails(
        method === "UPI"
          ? { method, upiId: upi.trim() }
          : { method, accountHolder: holder.trim(), accountNumber: account.trim(), ifsc: ifsc.trim().toUpperCase(), ...(bank.trim() ? { bankName: bank.trim() } : {}) }
      );
      await qc.invalidateQueries({ queryKey: ["me", "refund-details"] });
      showToast(t("Refund details saved"), "success");
      setEditing(false);
      setAccount("");
      setConfirmAccount("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("Could not save"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert(t("Remove details?"), t("Refunds for Cash on Delivery orders need a bank account or UPI ID."), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Remove"),
        style: "destructive",
        onPress: () => {
          void deleteRefundDetails().then(() => qc.invalidateQueries({ queryKey: ["me", "refund-details"] }));
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Bank & UPI Details" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { flexDirection: "row", gap: 10 }]}>
          <Feather name="info" size={18} color={C.navy} />
          <T size={12} color={C.textSoft} style={{ flex: 1 }}>
            Refunds for Cash on Delivery orders are sent to this bank account or UPI ID. Online payments are refunded to the original payment method.
          </T>
        </View>

        {q.isLoading ? (
          <ActivityIndicator color={C.brand} style={{ marginTop: 30 }} />
        ) : saved && !showForm ? (
          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name={saved.method === "UPI" ? "smartphone" : "home"} size={20} color={C.navy} />
              <T w="semibold" size={15} style={{ marginLeft: 10, flex: 1 }}>{saved.method === "UPI" ? "UPI ID" : "Bank account"}</T>
            </View>
            {saved.method === "UPI" ? (
              <T size={14} style={{ marginTop: 8 }}>{saved.upiId}</T>
            ) : (
              <View style={{ marginTop: 8, gap: 2 }}>
                <T size={14}>{saved.accountHolder}</T>
                <T size={13} color={C.textSoft}>{saved.accountNumberMasked}</T>
                <T size={13} color={C.textSoft}>IFSC {saved.ifsc}{saved.bankName ? ` · ${saved.bankName}` : ""}</T>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <PrimaryBtn label="Change" variant="outline" onPress={() => { setMethod(saved.method); setEditing(true); }} style={{ flex: 1 }} />
              <PrimaryBtn label="Remove" variant="outline" onPress={remove} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["UPI", "BANK"] as const).map((m) => (
                <Pressable key={m} onPress={() => setMethod(m)} style={[styles.chip, { flex: 1, alignItems: "center" }, method === m && styles.chipOn]}>
                  <T w={method === m ? "semibold" : "regular"} size={13} color={method === m ? C.navy : C.text}>{m === "UPI" ? "UPI ID" : "Bank account"}</T>
                </Pressable>
              ))}
            </View>
            {method === "UPI" ? (
              <Field label="UPI ID" value={upi} onChangeText={setUpi} placeholder="name@okaxis" autoCapitalize="none" keyboardType="email-address" />
            ) : (
              <>
                <Field label="Account holder name" value={holder} onChangeText={setHolder} autoCapitalize="words" />
                <Field label="Account number" value={account} onChangeText={(v) => setAccount(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={18} secureTextEntry />
                <Field label="Confirm account number" value={confirmAccount} onChangeText={(v) => setConfirmAccount(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={18} />
                <Field label="IFSC code" value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase())} placeholder="SBIN0001234" autoCapitalize="characters" maxLength={11} />
                <Field label="Bank name (optional)" value={bank} onChangeText={setBank} />
              </>
            )}
            <PrimaryBtn label="Save details" loading={saving} onPress={() => void save()} style={{ marginTop: 16 }} />
            {editing ? <PrimaryBtn label="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ marginTop: 8 }} /> : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Language ───────────────────────────────────────────────────────────── */

export function LanguageScreen() {
  const { lang, setLang } = useLanguage();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Language" />
      <View style={[styles.card, { margin: 16, paddingVertical: 4 }]}>
        {LANGUAGES.map((l, i) => {
          const on = l.code === lang;
          return (
            <Pressable key={l.code} onPress={() => setLang(l.code)} style={[styles.langRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.divider }]}>
              <View style={{ flex: 1 }}>
                <T w="semibold" size={15}>{l.native}</T>
                {l.native !== l.label ? <T size={12} color={C.muted}>{l.label}</T> : null}
              </View>
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? C.brandDark : C.faint} />
            </Pressable>
          );
        })}
      </View>
      <T size={12} color={C.muted} style={{ paddingHorizontal: 20 }}>Product names and descriptions are shown as written by the seller.</T>
    </View>
  );
}

/* ── Shared products / Recently viewed ─────────────────────────────────── */

function SavedProductList({ list, title, empty }: { list: "shared" | "recent"; title: string; empty: string }) {
  const router = useRouter();
  const t = useT();
  const items = useSavedProducts(list);
  const [sharing, setSharing] = React.useState<SavedProduct | null>(null);

  const clearAll = () =>
    Alert.alert(t("Clear all?"), undefined, [
      { text: t("Cancel"), style: "cancel" },
      { text: t("Clear"), style: "destructive", onPress: () => void clearList(list) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title={title} />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: S.page, gap: 8, paddingBottom: 30 }}
        ListHeaderComponent={
          items.length ? (
            <Pressable onPress={clearAll} style={{ alignSelf: "flex-end", paddingVertical: 4 }}>
              <T w="semibold" size={12} color={C.brandDark}>Clear all</T>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={<EmptyState title={empty} action={<PrimaryBtn label="Continue shopping" onPress={() => router.replace("/home")} style={{ marginTop: 10 }} />} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/product/${item.id}`)} style={styles.savedRow}>
            <View style={styles.thumb}>{item.image ? <CachedImage source={item.image} style={FILL} contentFit="cover" /> : null}</View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <T size={13} numberOfLines={2}>{item.title}</T>
              {item.price != null ? <T w="bold" size={15} style={{ marginTop: 4 }}>{inr(item.price)}</T> : null}
              <T size={11} color={C.faint} style={{ marginTop: 2 }}>
                {new Date(item.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </T>
            </View>
            <View style={{ gap: 14, alignItems: "center" }}>
              <Pressable onPress={() => setSharing(item)} hitSlop={8} accessibilityLabel="Share again">
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              </Pressable>
              <Pressable onPress={() => void forgetProduct(list, item.id)} hitSlop={8} accessibilityLabel="Remove">
                <Feather name="trash-2" size={17} color={C.faint} />
              </Pressable>
            </View>
          </Pressable>
        )}
      />
      <ShareSheet
        product={sharing ? { id: sharing.id, title: sharing.title, image: sharing.image, price: sharing.price, regularPrice: sharing.regularPrice ?? null } : null}
        open={Boolean(sharing)}
        onClose={() => setSharing(null)}
      />
    </View>
  );
}

export function SharedProductsScreen() {
  return <SavedProductList list="shared" title="Shared Products" empty="Products you share on WhatsApp appear here" />;
}

export function RecentlyViewedScreen() {
  return <SavedProductList list="recent" title="Recently Viewed" empty="Products you open appear here" />;
}

/* ── Video calls (appointments) ─────────────────────────────────────────── */

const STATUS_TONE: Record<Appointment["status"], string> = {
  PENDING: "#B45309",
  CONFIRMED: C.green,
  COMPLETED: C.muted,
  CANCELLED: C.red,
};

export function AppointmentsScreen() {
  const router = useRouter();
  const t = useT();
  const { showToast } = useToast();
  const { session } = useAuth();
  const q = useQuery({ queryKey: ["me", "appointments"], queryFn: ({ signal }) => listMyAppointments(signal), enabled: Boolean(session) });

  if (!session) return <View style={{ flex: 1, backgroundColor: C.bg }}><ScreenHeader title="Video Calls" /><SignInPrompt /></View>;

  const cancel = (a: Appointment) =>
    Alert.alert(t("Cancel this video call?"), undefined, [
      { text: t("Keep"), style: "cancel" },
      {
        text: t("Cancel call"),
        style: "destructive",
        onPress: () => {
          cancelAppointment(a.id)
            .then(() => q.refetch())
            .catch((err: unknown) => showToast(err instanceof Error ? err.message : t("Could not cancel"), "error"));
        },
      },
    ]);

  const items = q.data ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Video Calls" />
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        contentContainerStyle={{ padding: S.page, gap: 8, paddingBottom: 30 }}
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState title="No video calls yet" text="Open a product and tap “Video call with seller” to see it live before buying." />
          )
        }
        renderItem={({ item: a }) => {
          const when = new Date(a.startsAt ?? `${String(a.date).slice(0, 10)}T${a.time}:00`);
          const store = a.seller?.seller_profiles?.store_name ?? "Seller";
          const open = a.status === "PENDING" || a.status === "CONFIRMED";
          return (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="video" size={18} color={C.navy} />
                <T w="semibold" size={14} style={{ marginLeft: 8, flex: 1 }} numberOfLines={1}>{store}</T>
                <T w="semibold" size={11} color={STATUS_TONE[a.status]}>{t(a.status.charAt(0) + a.status.slice(1).toLowerCase())}</T>
              </View>
              {a.product ? (
                <Pressable onPress={() => router.push(`/product/${a.product!.id}`)}>
                  <T size={13} color={C.textSoft} numberOfLines={1} style={{ marginTop: 6 }}>{a.product.title}</T>
                </Pressable>
              ) : null}
              <T size={12} color={C.muted} style={{ marginTop: 4 }}>
                {when.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {when.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
              </T>
              {open ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  {a.joinActive && a.whatsappLink ? (
                    <PrimaryBtn label="Join on WhatsApp" icon="video" onPress={() => void Linking.openURL(a.whatsappLink!)} style={{ flex: 1 }} />
                  ) : null}
                  <PrimaryBtn label="Cancel call" variant="outline" onPress={() => cancel(a)} style={{ flex: 1 }} />
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14 },
  input: { marginTop: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.regular, fontSize: 14, color: C.text, backgroundColor: C.card },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  chipOn: { borderColor: C.navy, backgroundColor: C.navySoft },
  langRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14 },
  savedRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 10 },
  thumb: { width: 72, height: 80, borderRadius: 8, overflow: "hidden", backgroundColor: C.divider },
});
