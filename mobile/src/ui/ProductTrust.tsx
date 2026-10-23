/**
 * Product screen extras: available offers, "Notify me" for sold-out sizes,
 * review actions (helpful vote, report), Questions & answers and
 * "Report incorrect product information".
 */

import * as React from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../providers/ToastProvider";
import { useT } from "../i18n";
import { C } from "./theme";
import { PrimaryBtn, RadioRow, Sheet, T } from "./kit";
import { couponHeadline, getProductOffers } from "../services/offers";
import { notifyBackInStock } from "../services/account";
import {
  askProductQuestion,
  fetchProductQuestions,
  PRODUCT_REPORT_TYPES,
  REVIEW_REPORT_REASONS,
  reportProductInfo,
  reportReview,
  toggleReviewHelpful,
  type ProductQuestion,
  type Review,
} from "../services/reviews";

export function ProductOffersCard({ productId }: { productId: string }) {
  const t = useT();
  const [lines, setLines] = React.useState<string[]>([]);
  React.useEffect(() => {
    getProductOffers(productId)
      .then((d) => {
        const out = d.coupons.map((c) => `${couponHeadline(c)}${c.minOrderAmount > 0 ? ` ${t("on orders of")} ₹${c.minOrderAmount}+` : ""} · ${c.autoApply ? t("applied automatically") : `${t("code")} ${c.code}`}`);
        if (d.welcome) out.push(`₹${d.welcome.amount} ${t("off your first order of")} ₹${d.welcome.minOrder}+ · ${t("applied automatically")}`);
        if (d.cashbackPercent > 0) out.push(`${d.cashbackPercent}% ${t("cashback to your wallet after delivery")}`);
        setLines(out);
      })
      .catch(() => setLines([]));
  }, [productId, t]);
  if (!lines.length) return null;
  return (
    <View style={styles.card}>
      <T w="semibold" size={13}>{t("Available offers")}</T>
      {lines.slice(0, 4).map((l) => (
        <View key={l} style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
          <Feather name="tag" size={14} color={C.green} style={{ marginTop: 2 }} />
          <T size={12} style={{ flex: 1 }}>{l}</T>
        </View>
      ))}
    </View>
  );
}

/** "Notify me" when the chosen size / any size is sold out. */
export function NotifyMeRow({ productId, variantId, label }: { productId: string; variantId: string | null; label: string }) {
  const t = useT();
  const router = useRouter();
  const { session } = useAuth();
  const { showToast } = useToast();
  const [done, setDone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    if (!session?.accessToken) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      await notifyBackInStock(productId, variantId);
      setDone(true);
      showToast(t("We'll let you know when it's back in stock"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not set the alert", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
      <Feather name="bell" size={16} color={C.brandDark} />
      <T size={12} style={{ flex: 1 }}>{label} {t("is sold out.")}</T>
      <Pressable onPress={() => void go()} disabled={busy || done} hitSlop={6} accessibilityRole="button">
        <T w="semibold" size={13} color={done ? C.green : C.brandDark}>{done ? t("Alert on") : t("Notify me")}</T>
      </Pressable>
    </View>
  );
}

/** Verified badge, size bought, Helpful toggle and Report for one review. */
export function ReviewTrustRow({ review, onChange }: { review: Review; onChange?: () => void }) {
  const t = useT();
  const router = useRouter();
  const { session } = useAuth();
  const { showToast } = useToast();
  const [count, setCount] = React.useState(review.helpfulCount ?? 0);
  const [voted, setVoted] = React.useState(false);
  const [reported, setReported] = React.useState(false);

  const helpful = async () => {
    if (!session?.accessToken) return router.push("/login");
    try {
      const r = await toggleReviewHelpful(review.id);
      setCount(r.helpfulCount);
      setVoted(r.voted);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not vote", "error");
    }
  };
  const report = () => {
    if (!session?.accessToken) return router.push("/login");
    Alert.alert(t("Report this review"), t("Why are you reporting it?"), [
      ...REVIEW_REPORT_REASONS.slice(0, 4).map((r) => ({
        text: t(r.label),
        onPress: () =>
          void reportReview(review.id, r.value)
            .then(() => {
              setReported(true);
              showToast(t("Thanks — our team will look at it."), "success");
              onChange?.();
            })
            .catch((err) => showToast(err instanceof Error ? err.message : "Could not report", "error")),
      })),
      { text: t("Cancel"), style: "cancel" as const },
    ]);
  };

  return (
    <View style={{ marginTop: 6, gap: 4 }}>
      {review.verifiedPurchase || review.variantLabel ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {review.verifiedPurchase ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="checkmark-circle" size={12} color={C.green} />
              <T w="semibold" size={11} color={C.green}>{t("Verified purchase")}</T>
            </View>
          ) : null}
          {review.variantLabel ? <T size={11} color={C.muted}>{t("Bought")}: {review.variantLabel}</T> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 18 }}>
        <Pressable onPress={() => void helpful()} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} accessibilityRole="button" accessibilityState={{ selected: voted }}>
          <Feather name="thumbs-up" size={13} color={voted ? C.brandDark : C.muted} />
          <T size={11} color={voted ? C.brandDark : C.muted}>{t("Helpful")}{count ? ` (${count})` : ""}</T>
        </Pressable>
        {reported ? (
          <T size={11} color={C.muted}>{t("Reported")}</T>
        ) : (
          <Pressable onPress={report} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} accessibilityRole="button">
            <Feather name="flag" size={12} color={C.muted} />
            <T size={11} color={C.muted}>{t("Report")}</T>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Questions & answers + "Report incorrect product information". */
export function ProductQA({ productId }: { productId: string }) {
  const t = useT();
  const router = useRouter();
  const { session } = useAuth();
  const { showToast } = useToast();
  const [questions, setQuestions] = React.useState<ProductQuestion[]>([]);
  const [asking, setAsking] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportType, setReportType] = React.useState<string>(PRODUCT_REPORT_TYPES[0].value);
  const [details, setDetails] = React.useState("");

  React.useEffect(() => {
    fetchProductQuestions(productId).then((r) => setQuestions(r.questions)).catch(() => undefined);
  }, [productId]);

  const signedIn = () => {
    if (session?.accessToken) return true;
    router.push("/login");
    return false;
  };

  const ask = async () => {
    if (!signedIn()) return;
    if (text.trim().length < 10) return showToast(t("Please write at least 10 characters."), "info");
    setBusy(true);
    try {
      await askProductQuestion(productId, text.trim());
      showToast(t("Question sent. We'll notify you when the seller answers."), "success");
      setText("");
      setAsking(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send", "error");
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async () => {
    setBusy(true);
    try {
      await reportProductInfo(productId, reportType, details);
      showToast(t("Thanks for letting us know. Our team will check this listing."), "success");
      setReportOpen(false);
      setDetails("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send the report", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T w="semibold" size={15}>{t("Questions & Answers")}</T>
        {!asking ? (
          <Pressable onPress={() => signedIn() && setAsking(true)} hitSlop={6}>
            <T w="semibold" size={13} color={C.brandDark}>{t("Ask a question")}</T>
          </Pressable>
        ) : null}
      </View>
      {asking ? (
        <View style={{ marginTop: 8 }}>
          <TextInput value={text} onChangeText={setText} multiline maxLength={500} placeholder={t("e.g. Is the fabric see-through?")} placeholderTextColor={C.faint} style={styles.input} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <PrimaryBtn label="Submit question" onPress={() => void ask()} loading={busy} style={{ flex: 1 }} />
            <PrimaryBtn label="Cancel" variant="outline" onPress={() => setAsking(false)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}
      {questions.length === 0 ? (
        <T size={12} color={C.muted} style={{ marginTop: 6 }}>{t("No questions answered yet.")}</T>
      ) : (
        questions.slice(0, 5).map((q) => (
          <View key={q.id} style={{ marginTop: 10 }}>
            <T w="medium" size={13}>Q: {q.question}</T>
            <T size={12} color={C.textSoft} style={{ marginTop: 2 }}>A: {q.answer}</T>
            <T size={10} color={C.faint}>{t("Answered by")} {q.answeredBy}</T>
          </View>
        ))
      )}
      <Pressable onPress={() => signedIn() && setReportOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 }} hitSlop={6}>
        <Feather name="flag" size={13} color={C.muted} />
        <T size={12} color={C.muted}>{t("Report incorrect product information")}</T>
      </Pressable>
      <Sheet open={reportOpen} title={t("What's wrong with this listing?")} onClose={() => setReportOpen(false)}>
        <View style={{ padding: 16 }}>
          {PRODUCT_REPORT_TYPES.map((r) => <RadioRow key={r.value} label={t(r.label)} selected={reportType === r.value} onPress={() => setReportType(r.value)} />)}
          <TextInput value={details} onChangeText={setDetails} multiline maxLength={1000} placeholder={t("Tell us what is incorrect (optional)")} placeholderTextColor={C.faint} style={[styles.input, { marginTop: 8 }]} />
          <PrimaryBtn label="Send report" onPress={() => void sendReport()} loading={busy} style={{ marginTop: 12 }} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, marginTop: 10, backgroundColor: C.card },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, minHeight: 60, color: C.text, textAlignVertical: "top", backgroundColor: C.card },
});
