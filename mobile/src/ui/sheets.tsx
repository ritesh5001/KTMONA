import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { C, F } from "./theme";
import { PrimaryBtn, Sheet, T } from "./kit";
import { useT } from "../i18n";
import { useToast } from "../providers/ToastProvider";
import { shareOnWhatsApp, sharePhoto, shareText, type ShareableProduct } from "../lib/share-product";
import { bookAppointment } from "../services/extras";

/* ── Share ──────────────────────────────────────────────────────────────── */

/** Meesho's share options: WhatsApp first, then photo, then any app. */
export function ShareSheet({ product, open, onClose }: { product: ShareableProduct | null; open: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const t = useT();
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      onClose();
    } catch {
      showToast(t("Couldn't share right now. Please try again."), "error");
    } finally {
      setBusy(null);
    }
  };

  const options: { key: string; icon: React.ReactNode; label: string; hint: string; onPress: () => void }[] = product
    ? [
        {
          key: "wa",
          icon: <Ionicons name="logo-whatsapp" size={24} color="#25D366" />,
          label: "Share on WhatsApp",
          hint: "Send the product, price and link",
          onPress: () => void run("wa", () => shareOnWhatsApp(product)),
        },
        {
          key: "photo",
          icon: <Feather name="image" size={22} color={C.navy} />,
          label: "Share photo",
          hint: "Send the product photo to any app",
          onPress: () => void run("photo", () => sharePhoto(product)),
        },
        {
          key: "more",
          icon: <Feather name="share-2" size={22} color={C.navy} />,
          label: "More options",
          hint: "Copy link, SMS, email and other apps",
          onPress: () => void run("more", () => shareText(product)),
        },
      ]
    : [];

  return (
    <Sheet open={open} title="Share product" onClose={onClose}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={o.onPress} disabled={busy !== null} style={styles.shareRow}>
          <View style={styles.shareIcon}>{busy === o.key ? <ActivityIndicator color={C.brand} /> : o.icon}</View>
          <View style={{ flex: 1 }}>
            <T w="semibold" size={14}>{o.label}</T>
            <T size={12} color={C.muted}>{o.hint}</T>
          </View>
          <Feather name="chevron-right" size={18} color={C.faint} />
        </Pressable>
      ))}
    </Sheet>
  );
}

/* ── Book a video call with the seller ─────────────────────────────────── */

const SLOTS = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"];

function nextDays(n: number) {
  const out: { iso: string; day: string; date: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ iso, day: d.toLocaleDateString("en-IN", { weekday: "short" }), date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) });
  }
  return out;
}

function slotLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = (h ?? 0) >= 12 ? "PM" : "AM";
  const h12 = ((h ?? 0) % 12) || 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

/** See the product live on a WhatsApp video call with the seller before buying. */
export function BookCallSheet({
  open,
  onClose,
  sellerId,
  productId,
  storeName,
}: {
  open: boolean;
  onClose: () => void;
  sellerId: string;
  productId: string;
  storeName?: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const { showToast } = useToast();
  const days = React.useMemo(() => nextDays(7), []);
  const [date, setDate] = React.useState(days[0]!.iso);
  const [time, setTime] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Slots already in the past today are not offered.
  const now = new Date();
  const isToday = date === days[0]!.iso;
  const slots = SLOTS.filter((s) => {
    if (!isToday) return true;
    const [h, m] = s.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0) > now.getHours() * 60 + now.getMinutes() + 30;
  });

  const submit = async () => {
    if (!time) return;
    setSaving(true);
    try {
      await bookAppointment({ sellerId, productId, date, time, ...(notes.trim() ? { notes: notes.trim() } : {}) });
      showToast(t("Video call requested. The seller will confirm it."), "success");
      onClose();
      router.push("/account/appointments" as never);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("Could not book the call"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} title="Video call with seller" onClose={onClose}>
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <T size={13} color={C.muted}>
          {storeName ? `${t("See this product live with")} ${storeName} ${t("on a WhatsApp video call before you buy.")}` : t("See this product live on a WhatsApp video call before you buy.")}
        </T>
        <T w="semibold" size={14} style={{ marginTop: 14 }}>Pick a day</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {days.map((d) => {
            const on = d.iso === date;
            return (
              <Pressable key={d.iso} onPress={() => { setDate(d.iso); setTime(null); }} style={[styles.dayChip, on && styles.chipOn]}>
                <T size={11} color={on ? C.navy : C.muted}>{d.day}</T>
                <T w="semibold" size={13} color={on ? C.navy : C.text}>{d.date}</T>
              </Pressable>
            );
          })}
        </ScrollView>
        <T w="semibold" size={14} style={{ marginTop: 6 }}>Pick a time</T>
        {slots.length === 0 ? (
          <T size={12} color={C.muted} style={{ marginTop: 6 }}>No more slots today. Pick another day.</T>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {slots.map((s) => {
              const on = s === time;
              return (
                <Pressable key={s} onPress={() => setTime(s)} style={[styles.timeChip, on && styles.chipOn]}>
                  <T size={12} w={on ? "semibold" : "regular"} color={on ? C.navy : C.text}>{slotLabel(s)}</T>
                </Pressable>
              );
            })}
          </View>
        )}
        <T w="semibold" size={14} style={{ marginTop: 14 }}>Anything to show you? (optional)</T>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t("e.g. Show the fabric in daylight")}
          placeholderTextColor={C.faint}
          multiline
          maxLength={500}
          style={styles.notes}
        />
        <T size={11} color={C.faint} style={{ marginTop: 6 }}>The seller confirms based on their availability. You can cancel from Account → Video Calls.</T>
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <PrimaryBtn label="Request video call" icon="video" loading={saving} onPress={() => void submit()} style={!time ? { opacity: 0.5 } : undefined} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  shareRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  shareIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  dayChip: { width: 64, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  timeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  chipOn: { borderColor: C.navy, backgroundColor: C.navySoft },
  notes: { marginTop: 8, minHeight: 70, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, fontFamily: F.regular, fontSize: 14, color: C.text, textAlignVertical: "top" },
});
