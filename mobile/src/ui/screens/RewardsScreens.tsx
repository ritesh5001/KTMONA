import * as React from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { useT } from "../../i18n";
import { C, S, inr } from "../theme";
import { EmptyState, PrimaryBtn, ScreenHeader, T } from "../kit";
import {
  getReferrals,
  getWallet,
  getWalletTransactions,
  type ReferralOverview,
  type WalletSummary,
  type WalletTransaction,
} from "../../services/account";

const SOURCE: Record<string, string> = {
  CASHBACK: "Cashback",
  REFERRAL: "Referral reward",
  CHECKOUT: "Used on order",
  ORDER_REFUND: "Returned from cancelled order",
  EXPIRY: "Expired",
  ADMIN: "Adjustment",
};

function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

function SignIn({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title={title} />
      <EmptyState title="Sign in to continue" action={<PrimaryBtn label="Sign Up / Log In" onPress={() => router.push("/login")} style={{ marginTop: 10 }} />} />
    </View>
  );
}

/** Account → Wallet & Cashback. */
export function WalletScreen() {
  const t = useT();
  const { session } = useAuth();
  const [summary, setSummary] = React.useState<WalletSummary | null>(null);
  const [rows, setRows] = React.useState<WalletTransaction[]>([]);

  React.useEffect(() => {
    if (!session?.accessToken) return;
    getWallet().then(setSummary).catch(() => undefined);
    getWalletTransactions().then((r) => setRows(r.transactions)).catch(() => undefined);
  }, [session?.accessToken]);

  if (!session?.accessToken) return <SignIn title="Wallet & Cashback" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Wallet & Cashback" />
      <ScrollView contentContainerStyle={{ padding: S.page, paddingBottom: 40, gap: 12 }}>
        {!summary ? (
          <ActivityIndicator color={C.brand} style={{ marginTop: 30 }} />
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: C.navy }]}>
              <T size={12} color={C.white} style={{ opacity: 0.8 }}>{t("Available")}</T>
              <T w="bold" size={30} color={C.white}>{inr(summary.available)}</T>
              <T size={11} color={C.white} style={{ opacity: 0.8 }}>
                {t("Use it at checkout for up to")} {summary.rules.maxUsePercent}% {t("of an order.")}
              </T>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.card, { flex: 1 }]}>
                <T size={11} color={C.muted}>{t("Pending")}</T>
                <T w="bold" size={18}>{inr(summary.pending)}</T>
                <T size={10} color={C.muted}>{t("Released")} {summary.rules.holdDays} {t("days after delivery")}</T>
              </View>
              <View style={[styles.card, { flex: 1 }]}>
                <T size={11} color={C.muted}>{t("Expiring next")}</T>
                <T w="bold" size={18}>{summary.nextExpiry ? inr(summary.nextExpiry.amount) : "—"}</T>
                {summary.nextExpiry ? <T size={10} color={C.muted}>{day(summary.nextExpiry.at)}</T> : null}
              </View>
            </View>
            <View style={styles.card}>
              <T w="semibold" size={14}>{t("How cashback works")}</T>
              <T size={12} color={C.textSoft} style={{ marginTop: 4 }}>
                • {t("Earn")} {summary.rules.cashbackPercent}% {t("back on every delivered order.")}{"\n"}
                • {t("Usable")} {summary.rules.holdDays} {t("days after delivery, if the order is not returned.")}{"\n"}
                • {t("Each credit can be used for")} {summary.rules.expiryDays} {t("days.")}{"\n"}
                • {t("Cashback cannot be withdrawn or transferred.")}
              </T>
            </View>
            <View style={styles.card}>
              <T w="semibold" size={14}>{t("History")}</T>
              {rows.length === 0 ? (
                <T size={12} color={C.muted} style={{ marginTop: 6 }}>{t("No wallet activity yet.")}</T>
              ) : (
                rows.map((r) => (
                  <View key={r.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <T w="medium" size={13}>{t(SOURCE[r.source] ?? r.source)}</T>
                      <T size={11} color={C.muted}>
                        {day(r.createdAt)}
                        {r.status === "PENDING" ? ` · ${t("usable from")} ${day(r.availableAt)}` : r.status === "REVERSED" ? ` · ${t("cancelled")}` : r.expiresAt && r.status === "AVAILABLE" ? ` · ${t("expires")} ${day(r.expiresAt)}` : ""}
                      </T>
                    </View>
                    <T w="semibold" size={14} color={r.status === "REVERSED" ? C.faint : r.kind === "CREDIT" ? C.green : C.text}>
                      {r.kind === "CREDIT" ? "+" : "−"}{inr(r.amount)}
                    </T>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const STATUS: Record<ReferralOverview["referrals"][number]["status"], string> = {
  SIGNED_UP: "Joined — no order yet",
  ORDERED: "Ordered — reward after delivery",
  REWARDED: "Reward earned",
  CANCELLED: "Order cancelled / returned",
};

/** Account → Refer & Earn. */
export function ReferralsScreen() {
  const t = useT();
  const { session } = useAuth();
  const [data, setData] = React.useState<ReferralOverview | null>(null);

  React.useEffect(() => {
    if (session?.accessToken) getReferrals().then(setData).catch(() => undefined);
  }, [session?.accessToken]);

  if (!session?.accessToken) return <SignIn title="Refer & Earn" />;

  const message = data
    ? `${t("Shop on KTMONA and get")} ₹${data.rules.friendAmount} ${t("off your first order with my code")} ${data.code}: ${data.link}`
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Refer & Earn" />
      <ScrollView contentContainerStyle={{ padding: S.page, paddingBottom: 40, gap: 12 }}>
        {!data ? (
          <ActivityIndicator color={C.brand} style={{ marginTop: 30 }} />
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: C.navy, gap: 8 }]}>
              <T size={12} color={C.white} style={{ opacity: 0.85 }}>
                {t("Friends get")} ₹{data.rules.friendAmount} {t("off their first order. You get")} ₹{data.rules.referrerAmount} {t("cashback when it's delivered.")}
              </T>
              <T w="bold" size={26} color={C.white} selectable style={{ letterSpacing: 3 }}>{data.code}</T>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <PrimaryBtn label="Share" icon="share-2" onPress={() => void Share.share({ message })} style={{ flex: 1 }} />
                <Pressable
                  onPress={() => void Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() => Share.share({ message }))}
                  style={styles.wa}
                  accessibilityRole="button"
                  accessibilityLabel={t("Share on WhatsApp")}
                >
                  <Feather name="message-circle" size={16} color={C.white} />
                  <T w="semibold" size={13} color={C.white}>WhatsApp</T>
                </Pressable>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.card, { flex: 1 }]}><T size={11} color={C.muted}>{t("Friends joined")}</T><T w="bold" size={18}>{data.stats.joined}</T></View>
              <View style={[styles.card, { flex: 1 }]}><T size={11} color={C.muted}>{t("Rewards earned")}</T><T w="bold" size={18}>{inr(data.stats.earned)}</T></View>
            </View>
            <View style={styles.card}>
              <T w="semibold" size={14}>{t("Your referrals")}</T>
              {data.referrals.length === 0 ? (
                <T size={12} color={C.muted} style={{ marginTop: 6 }}>{t("No one has joined with your code yet.")}</T>
              ) : (
                data.referrals.map((r) => (
                  <View key={r.id} style={styles.row}>
                    <T w="medium" size={13} style={{ flex: 1 }}>{r.name}</T>
                    <T size={11} color={r.status === "REWARDED" ? C.green : C.muted}>{t(STATUS[r.status])}</T>
                  </View>
                ))
              )}
            </View>
            <T size={11} color={C.muted}>
              {t("Your friend must sign up with your link or code and place a first order of")} ₹{data.rules.minOrder}+. {t("Up to")} {data.rules.maxRewards} {t("rewards per customer. Self-referrals are not eligible.")}
            </T>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider, marginTop: 6 },
  wa: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#25D366", borderRadius: 10 },
});
