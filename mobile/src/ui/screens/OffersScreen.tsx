import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useT } from "../../i18n";
import { C, S } from "../theme";
import { ScreenHeader, T } from "../kit";
import { couponHeadline, getOffers, type OffersResponse } from "../../services/offers";

/** Offers & Rewards: welcome offer, cashback, referral and public coupons, with terms. */
export default function OffersScreen() {
  const t = useT();
  const router = useRouter();
  const [data, setData] = React.useState<OffersResponse | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    getOffers().then(setData).catch(() => setFailed(true));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Offers & Rewards" />
      <ScrollView contentContainerStyle={{ padding: S.page, paddingBottom: 40, gap: 12 }}>
        {failed ? <T size={13} color={C.muted}>{t("Couldn't load offers. Please try again.")}</T> : null}
        {!data && !failed ? <ActivityIndicator color={C.brand} style={{ marginTop: 30 }} /> : null}
        {data ? (
          <>
            {data.welcome ? (
              <Reward icon="gift" title={`₹${data.welcome.amount} ${t("off your first order")}`}>
                {t("Applied automatically on a first order of")} ₹{data.welcome.minOrder}+. {t("No code needed.")}
              </Reward>
            ) : null}
            {data.cashback ? (
              <Reward icon="credit-card" title={`${data.cashback.percent}% ${t("cashback on every order")}`}>
                {t("Added to your wallet")} {data.cashback.holdDays} {t("days after delivery. Use it for up to")} {data.cashback.maxUsePercent}% {t("of an order within")} {data.cashback.expiryDays} {t("days.")}
              </Reward>
            ) : null}
            {data.referral ? (
              <Pressable onPress={() => router.push("/account/referrals")}>
                <Reward icon="users" title={`${t("Refer & earn")} ₹${data.referral.referrerAmount}`}>
                  {t("Your friend gets")} ₹{data.referral.friendAmount} {t("off their first order. Tap to get your code.")}
                </Reward>
              </Pressable>
            ) : null}

            <T w="semibold" size={15} style={{ marginTop: 6 }}>{t("Coupons")}</T>
            {data.coupons.length === 0 ? (
              <T size={12} color={C.muted}>{t("No coupons right now. Check back during sale events.")}</T>
            ) : (
              data.coupons.map((c) => (
                <View key={c.code} style={[styles.card, { borderStyle: "dashed", borderColor: C.brand }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <T w="bold" size={16}>{couponHeadline(c)}</T>
                      {c.title ? <T size={12} color={C.muted}>{c.title}</T> : null}
                    </View>
                    {c.autoApply ? (
                      <T w="semibold" size={11} color={C.green}>{t("Auto-applied")}</T>
                    ) : (
                      <Pressable onPress={() => void Share.share({ message: c.code })} style={styles.code} accessibilityLabel={`${t("Coupon code")} ${c.code}`}>
                        <T w="semibold" size={12} selectable>{c.code}</T>
                      </Pressable>
                    )}
                  </View>
                  <T size={11} color={C.muted} style={{ marginTop: 6 }}>
                    {c.minOrderAmount > 0 ? `${t("On orders of")} ₹${c.minOrderAmount}+ · ` : ""}
                    {t("Valid till")} {new Date(c.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </T>
                  {c.terms ? <T size={11} color={C.muted} style={{ marginTop: 4 }}>{c.terms}</T> : null}
                </View>
              ))
            )}

            <View style={styles.card}>
              <T w="semibold" size={13}>{t("Offer terms")}</T>
              <T size={11} color={C.muted} style={{ marginTop: 4 }}>
                • {t("One coupon per order. The welcome offer and referral bonus apply automatically on a first order.")}{"\n"}
                • {t("Cashback is not credited on cancelled or returned orders, and cannot be withdrawn or transferred.")}{"\n"}
                • {t("Offers can change or end without notice; the price shown at checkout is final.")}
              </T>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Reward({ icon, title, children }: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { flexDirection: "row", gap: 12 }]}>
      <Feather name={icon} size={22} color={C.brandDark} />
      <View style={{ flex: 1 }}>
        <T w="semibold" size={14}>{title}</T>
        <T size={12} color={C.textSoft} style={{ marginTop: 2 }}>{children}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  code: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
});
