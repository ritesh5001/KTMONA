/**
 * Order details sections built on the order view from GET /v1/orders/:id:
 * delivery timeline and per-parcel tracking, what the buyer can do next
 * (retry payment, cancel, return / replace, buy again), returns with pickup and
 * appeal, refunds and the charges breakup.
 */

import * as React from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { CachedImage } from "../components/CachedImage";
import { useToast } from "../providers/ToastProvider";
import { useT } from "../i18n";
import { C, FILL, inr } from "./theme";
import { PrimaryBtn, RadioRow, Sheet, T } from "./kit";
import { reorder, type BuyerOrderDetail, type BuyerOrderReturn, type TrackingStage } from "../services/orders";
import { requestCancellation } from "../services/cancellations";
import { appealReturn, requestReturn, RETURN_REASONS, SELLER_FAULT_REASONS, type ReturnReasonCode } from "../services/returns";
import { retryPayment } from "../services/payments";
import { confirmRazorpayPayment, openRazorpayCheckout } from "../services/razorpay-sdk";
import { buildReviewImageName, uploadReviewImage } from "../services/imagekit";

const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Delivery is taking too long",
  "Want to change the size / colour",
  "Want to change the delivery address",
  "Other",
];

function day(iso: string | null | undefined, withTime = false) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", withTime
    ? { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }
    : { weekday: "short", day: "numeric", month: "short" });
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <T w="semibold" size={14} style={{ marginBottom: 10 }}>{title}</T>
      {children}
    </View>
  );
}

function Banner({ tone, title, text, children }: { tone: "good" | "warn" | "info"; title: string; text?: string; children?: React.ReactNode }) {
  const bg = tone === "good" ? "#ECFDF5" : tone === "warn" ? "#FFFBEB" : "#EFF6FF";
  const fg = tone === "good" ? "#065F46" : tone === "warn" ? "#92400E" : "#1E3A8A";
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <T w="semibold" size={14} color={fg}>{title}</T>
      {text ? <T size={12} color={fg} style={{ marginTop: 2 }}>{text}</T> : null}
      {children}
    </View>
  );
}

function Timeline({ stages }: { stages: TrackingStage[] }) {
  return (
    <View>
      {stages.map((s, i) => {
        const bad = s.key === "CANCELLED" || s.key === "DELIVERY_FAILED";
        const next = stages[i + 1];
        return (
          <View key={s.key} style={{ flexDirection: "row" }}>
            <View style={{ alignItems: "center", width: 24 }}>
              <View style={[styles.dot, s.done && { backgroundColor: bad ? C.red : C.green, borderColor: bad ? C.red : C.green }]}>
                {s.done ? <Feather name={bad ? "x" : "check"} size={11} color={C.white} /> : null}
              </View>
              {next ? <View style={[styles.line, next.done && { backgroundColor: C.green }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingLeft: 8, paddingBottom: next ? 14 : 0 }}>
              <T size={13} w={s.done ? "semibold" : "regular"} color={s.done ? C.text : C.muted}>{s.label}</T>
              {s.at ? <T size={11} color={C.muted}>{day(s.at, true)}</T> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ShipmentInfo({ s }: { s: NonNullable<BuyerOrderDetail["shipments"]>[number] }) {
  const t = useT();
  return (
    <View style={styles.shipBox}>
      <T size={12}>{t("Courier")}: <T w="semibold" size={12}>{s.carrier}</T></T>
      {s.trackingNumber ? (
        <T size={12} selectable>{t("Tracking ID")}: <T w="semibold" size={12} selectable>{s.trackingNumber}</T></T>
      ) : null}
      {s.courierStatus ? <T size={11} color={C.muted}>{t("Latest update")}: {s.courierStatus}</T> : null}
      {s.trackingUrl ? (
        <Pressable onPress={() => void Linking.openURL(s.trackingUrl!)} hitSlop={6} style={{ marginTop: 4 }} accessibilityRole="link">
          <T w="semibold" size={12} color={C.brandDark}>{t("Track on courier website")} ↗</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function OrderExtras({
  order,
  token,
  placed,
  onChanged,
}: {
  order: BuyerOrderDetail;
  token: string | null;
  placed?: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { showToast } = useToast();
  const [sheet, setSheet] = React.useState<"cancel" | "return" | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const shipments = order.shipments ?? [];
  const timeline = order.timeline ?? [];
  const unpaid = order.status === "PLACED" && order.paymentMethod !== "COD";
  const attempt = shipments.find((s) => s.deliveryAttempt)?.deliveryAttempt;
  const late = order.estimatedDelivery && order.status === "SHIPPED" && Date.now() > new Date(order.estimatedDelivery.to).getTime();
  const itemsById = new Map(order.items.map((i) => [i.id, i]));

  const retry = async () => {
    if (!token) return;
    setBusy("pay");
    try {
      const { data: payment } = await retryPayment(order.id, token);
      const result = await openRazorpayCheckout(payment);
      if (result.status === "paid") {
        const state = await confirmRazorpayPayment(order.id, token, result);
        showToast(state === "SUCCESS" ? t("Payment successful") : t("Payment received. We're confirming your order."), "success");
        onChanged();
      } else if (result.status === "failed") {
        showToast(result.error, "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to retry payment", "error");
    } finally {
      setBusy(null);
    }
  };

  const buyAgain = async () => {
    setBusy("reorder");
    try {
      const res = await reorder(order.id, token);
      showToast(t(res.message), res.added > 0 ? "success" : "error");
      if (res.added > 0) router.push("/cart");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to add to cart", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {placed && !unpaid ? (
        <Banner
          tone="good"
          title={t("Order placed successfully!")}
          text={order.paymentMethod === "COD"
            ? `${t("Please keep")} ${inr(order.totalAmount)} ${t("ready to pay on delivery.")}`
            : t("Your payment was successful. A confirmation has been sent to your email.")}
        />
      ) : null}
      {unpaid ? (
        <Banner tone="warn" title={order.paymentStatus === "FAILED" ? t("Payment failed") : t("Payment pending")} text={t("Complete the payment within 30 minutes of ordering. Retrying never creates a second order.")}>
          <PrimaryBtn label={`${t("Retry payment")} · ${inr(order.totalAmount)}`} onPress={() => void retry()} loading={busy === "pay"} style={{ marginTop: 10 }} />
        </Banner>
      ) : null}
      {attempt ? <Banner tone="warn" title={t("Delivery attempt unsuccessful")} text={`${attempt.note}. ${t("The courier will try again. Keep your phone reachable.")}`} /> : null}
      {late && !attempt ? <Banner tone="info" title={t("Running a little late")} text={t("Your order is taking longer than expected. It is still on its way and we are following up with the courier.")} /> : null}

      {timeline.length && order.status !== "PLACED" ? (
        <Card title={t("Track your order")}>
          {order.estimatedDelivery ? (
            <T size={13} style={{ marginBottom: 10 }}>
              {t("Estimated delivery")}: <T w="semibold" size={13}>{day(order.estimatedDelivery.from)} – {day(order.estimatedDelivery.to)}</T>
            </T>
          ) : null}
          {shipments.length <= 1 ? (
            <>
              <Timeline stages={shipments[0]?.stages ?? timeline} />
              {shipments[0] ? <ShipmentInfo s={shipments[0]} /> : order.status !== "CANCELLED" ? (
                <T size={12} color={C.muted} style={{ marginTop: 10 }}>{t("Waiting for the seller to confirm and pack your order.")}</T>
              ) : null}
            </>
          ) : (
            shipments.map((s, i) => (
              <View key={s.id} style={{ marginBottom: 14 }}>
                <T w="semibold" size={12} style={{ marginBottom: 6 }}>
                  {t("Package")} {i + 1}: {s.itemIds.map((id) => itemsById.get(id)?.productTitle).filter(Boolean).join(", ")}
                </T>
                <Timeline stages={s.stages} />
                <ShipmentInfo s={s} />
              </View>
            ))
          )}
        </Card>
      ) : null}

      <Card title={t("Need anything?")}>
        <View style={{ gap: 8 }}>
          {order.eligibility?.cancel.allowed ? (
            <PrimaryBtn label="Cancel order" variant="outline" icon="x" onPress={() => setSheet("cancel")} />
          ) : null}
          {order.eligibility?.return.allowed ? (
            <PrimaryBtn label="Return / Replace" variant="outline" icon="rotate-ccw" onPress={() => setSheet("return")} />
          ) : null}
          <PrimaryBtn label="Buy again" variant="outline" icon="shopping-cart" onPress={() => void buyAgain()} loading={busy === "reorder"} />
          <PrimaryBtn label="Help & Support" variant="outline" icon="message-circle" onPress={() => router.push("/support")} />
        </View>
        <PolicyText order={order} />
      </Card>

      {order.returns?.length ? (
        <Card title={t("Returns & replacements")}>
          {order.returns.map((r) => <ReturnCard key={r.id} r={r} order={order} token={token} onChanged={onChanged} />)}
        </Card>
      ) : null}

      {order.cancellation ? (
        <Card title={t("Cancellation")}>
          <T size={13}>
            {order.cancellation.status === "REQUESTED" ? t("Requested — the seller is reviewing it") : order.cancellation.status === "APPROVED" ? t("Cancelled") : t("Declined")}
          </T>
          <T size={12} color={C.muted}>{t("Reason")}: {order.cancellation.reason}</T>
          {order.cancellation.rejectionReason ? <T size={12} color={C.muted}>{t("Why it was declined")}: {order.cancellation.rejectionReason}</T> : null}
        </Card>
      ) : null}

      {order.refunds?.length ? (
        <Card title={t("Refunds")}>
          {order.refunds.map((r) => (
            <View key={r.id} style={styles.refundRow}>
              <View style={{ flex: 1 }}>
                <T w="semibold" size={14}>{inr(r.amount)}</T>
                <T size={11} color={C.muted}>
                  {r.status === "SUCCESS" ? `${t("Refunded on")} ${day(r.updatedAt)}` : r.status === "PENDING" ? `${t("Processing since")} ${day(r.createdAt)}` : t("Refund failed — our team will retry or contact you")}
                </T>
                {r.reference ? <T size={11} color={C.muted} selectable>{t("Ref")} {r.reference}</T> : null}
              </View>
              <T w="semibold" size={11} color={r.status === "SUCCESS" ? C.green : r.status === "PENDING" ? "#B45309" : C.red}>
                {r.status === "SUCCESS" ? t("Refunded") : r.status === "PENDING" ? t("Processing") : t("Failed")}
              </T>
            </View>
          ))}
          <T size={11} color={C.muted} style={{ marginTop: 6 }}>
            {t("Online payments go back to the original method: UPI usually within 24 hours, cards and net banking in 5–7 working days. COD refunds go to your saved bank / UPI details.")}
          </T>
        </Card>
      ) : null}

      {order.charges ? (
        <Card title={t("Price details")}>
          <Line label="Price (MRP)" value={inr(order.charges.mrpTotal)} />
          {order.charges.productDiscount > 0 ? <Line label="Discount on MRP" value={`−${inr(order.charges.productDiscount)}`} good /> : null}
          {order.charges.couponDiscount > 0 ? <Line label={`${t("Coupon")} ${order.charges.couponCode ?? ""}`} value={`−${inr(order.charges.couponDiscount)}`} good /> : null}
          {order.charges.autoDiscount ? <Line label={order.charges.autoDiscountLabel ?? "Offer"} value={`−${inr(order.charges.autoDiscount)}`} good /> : null}
          <Line label="Delivery" value={order.charges.shipping > 0 ? inr(order.charges.shipping) : "FREE"} />
          {order.charges.tax > 0 ? <Line label="GST" value={inr(order.charges.tax)} /> : null}
          {order.charges.walletAmount ? <Line label="Cashback used" value={`−${inr(order.charges.walletAmount)}`} good /> : null}
          <View style={{ height: 1, backgroundColor: C.divider, marginVertical: 6 }} />
          <Line label="Order total" value={inr(order.charges.total)} bold />
          <T size={11} color={C.muted}>{order.paymentMethod === "COD" ? t("Cash on Delivery") : t("Paid online")}</T>
        </Card>
      ) : null}

      <CancelSheet open={sheet === "cancel"} order={order} token={token} onClose={() => setSheet(null)} onDone={onChanged} />
      <ReturnSheet open={sheet === "return"} order={order} token={token} onClose={() => setSheet(null)} onDone={onChanged} />
    </>
  );
}

function Line({ label, value, good, bold }: { label: string; value: string; good?: boolean; bold?: boolean }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <T size={13} w={bold ? "semibold" : "regular"} color={bold ? C.text : C.muted}>{t(label)}</T>
      <T size={13} w={bold ? "semibold" : "regular"} color={good ? C.green : C.text}>{value === "FREE" ? t("FREE") : value}</T>
    </View>
  );
}

function PolicyText({ order }: { order: BuyerOrderDetail }) {
  const t = useT();
  const e = order.eligibility;
  if (!e) return null;
  let text: string | null = null;
  if (order.status === "DELIVERED") {
    text = e.return.allowed && e.return.windowEndsAt
      ? `${t("Return or replacement available until")} ${day(e.return.windowEndsAt)}.`
      : e.return.reason;
  } else if (order.status !== "CANCELLED") {
    text = e.cancel.allowed
      ? t("Free cancellation until the order ships. After delivery you can return or replace items within 7 days.")
      : e.cancel.reason;
  }
  return text ? <T size={11} color={C.muted} style={{ marginTop: 10 }}>{text}</T> : null;
}

const RETURN_STATUS: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  INSPECTING: "Under inspection",
  REFUNDED: "Refunded",
  REPLACED: "Replacement sent",
  REJECTED: "Rejected",
};

function ReturnCard({ r, order, token, onChanged }: { r: BuyerOrderReturn; order: BuyerOrderDetail; token: string | null; onChanged: () => void }) {
  const t = useT();
  const { showToast } = useToast();
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const reason = RETURN_REASONS.find((x) => x.code === r.reasonCode)?.label ?? r.reason;
  const titles = r.items.map((i) => order.items.find((o) => o.id === i.orderItemId)?.productTitle ?? "Item").join(", ");
  const open = !["REJECTED", "REFUNDED", "REPLACED"].includes(r.status);
  const pickup = r.pickupStatus === "SCHEDULED" ? "Pickup scheduled" : r.pickupStatus === "PICKED_UP" ? "Picked up" : r.pickupStatus === "RECEIVED" ? "Received by seller" : "Pickup to be scheduled";

  const appeal = async () => {
    setSending(true);
    try {
      await appealReturn(r.id, note, token);
      showToast(t("Appeal sent. Our team will review it within 48 hours."), "success");
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send the appeal", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.returnBox}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T w="semibold" size={13}>{t(r.type === "REPLACEMENT" ? "Replacement" : "Return")} · {day(r.createdAt)}</T>
        <T w="semibold" size={12} color={r.status === "REJECTED" ? C.red : open ? "#B45309" : C.green}>{t(RETURN_STATUS[r.status] ?? r.status)}</T>
      </View>
      <T size={12} color={C.muted}>{titles}</T>
      <T size={12}>{t("Reason")}: {t(reason)}</T>
      {open ? (
        <View style={styles.pickupBox}>
          <T w="semibold" size={12}>{t(pickup)}{r.pickupDate ? ` · ${day(r.pickupDate)}` : ""}</T>
          {r.pickupTracking ? <T size={11} selectable>{[r.pickupCarrier, r.pickupTracking].filter(Boolean).join(" ")}</T> : null}
          <T size={11} color={C.muted}>{t("The courier will collect the item from your delivery address. Keep it unused, with tags and the original packaging.")}</T>
        </View>
      ) : null}
      {r.status === "REPLACED" ? <T size={12} color={C.green}>{t("Your replacement is on its way")}{r.replacementTracking ? ` (${r.replacementTracking})` : ""}.</T> : null}
      {r.status === "REFUNDED" && r.refundAmount != null ? <T size={12} color={C.green}>{t("Refund processed")}: {inr(r.refundAmount)}</T> : null}
      {r.status === "REJECTED" ? (
        <View style={[styles.pickupBox, { backgroundColor: "#FEF2F2" }]}>
          <T size={12} color={C.red}>{t("Why it was rejected")}: {r.rejectionReason ?? t("The request did not meet the return policy.")}</T>
          {r.appealedAt ? (
            <T size={11} color={C.muted}>{t("You appealed on")} {day(r.appealedAt)}. {t("Our team will get back to you.")}</T>
          ) : (
            <>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                placeholder={t("Tell us why this should be reconsidered")}
                placeholderTextColor={C.faint}
                style={styles.textArea}
              />
              <PrimaryBtn label="Appeal decision" onPress={() => void appeal()} loading={sending} style={{ marginTop: 8 }} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function CancelSheet({ open, order, token, onClose, onDone }: { open: boolean; order: BuyerOrderDetail; token: string | null; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const { showToast } = useToast();
  const [reason, setReason] = React.useState(CANCEL_REASONS[0]!);
  const [other, setOther] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const submit = async () => {
    const text = reason === "Other" ? other.trim() : reason;
    if (text.length < 3) return showToast(t("Please tell us why you want to cancel."), "info");
    setSending(true);
    try {
      await requestCancellation(order.id, text, token);
      showToast(t("Cancellation requested"), "success");
      onClose();
      onDone();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to request cancellation", "error");
    } finally {
      setSending(false);
    }
  };
  return (
    <Sheet open={open} title={t("Cancel order")} onClose={onClose}>
      <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.pickupBox}>
          <T w="semibold" size={12}>{t("Cancellation is free before the order ships.")}</T>
          <T size={11} color={C.muted}>
            {order.paymentMethod === "COD"
              ? t("Nothing was charged for this Cash on Delivery order.")
              : t("The amount is refunded to your original payment method (UPI within 24 hours, cards/net banking in 5–7 working days).")}
          </T>
        </View>
        {CANCEL_REASONS.map((r) => <RadioRow key={r} label={t(r)} selected={reason === r} onPress={() => setReason(r)} />)}
        {reason === "Other" ? (
          <TextInput value={other} onChangeText={setOther} multiline placeholder={t("Tell us more")} placeholderTextColor={C.faint} style={styles.textArea} />
        ) : null}
        <PrimaryBtn label="Request cancellation" onPress={() => void submit()} loading={sending} style={{ marginTop: 12 }} />
      </ScrollView>
    </Sheet>
  );
}

function ReturnSheet({ open, order, token, onClose, onDone }: { open: boolean; order: BuyerOrderDetail; token: string | null; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const { showToast } = useToast();
  const [type, setType] = React.useState<"RETURN" | "REPLACEMENT">("RETURN");
  const [reasonCode, setReasonCode] = React.useState<ReturnReasonCode | null>(null);
  const [details, setDetails] = React.useState("");
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (open) setSelected(Object.fromEntries(order.items.map((i) => [i.id, order.items.length === 1])));
  }, [open, order.items]);

  const reason = RETURN_REASONS.find((r) => r.code === reasonCode);
  const chosen = order.items.filter((i) => selected[i.id]);
  const blocked = reasonCode != null && !SELLER_FAULT_REASONS.has(reasonCode) && chosen.some((i) => i.isReturnable === false);

  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return showToast(t("Photo access is needed to add pictures"), "info");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 6 - photos.length });
    if (result.canceled) return;
    setUploading(true);
    try {
      for (const [i, a] of result.assets.entries()) {
        const url = await uploadReviewImage({ uri: a.uri, fileName: buildReviewImageName(i).replace("review", "return"), mimeType: a.mimeType ?? "image/jpeg" });
        setPhotos((p) => [...p, url].slice(0, 6));
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Photo upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!chosen.length) return showToast(t("Select at least one item."), "info");
    if (!reason) return showToast(t("Select a reason."), "info");
    if (reason.needsPhoto && photos.length === 0) return showToast(t("Please add a photo showing the problem."), "info");
    if (blocked) return Alert.alert(t("Non-returnable item"), t("Non-returnable items can come back only if wrong, damaged, defective or incomplete."));
    setSending(true);
    try {
      await requestReturn(
        order.id,
        details.trim().length >= 3 ? details.trim() : reason.label,
        chosen.map((i) => ({ orderItemId: i.id, quantity: i.quantity })),
        token,
        undefined,
        { type, reasonCode: reason.code, images: photos },
      );
      showToast(t(type === "REPLACEMENT" ? "Replacement requested" : "Return requested"), "success");
      onClose();
      onDone();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to submit the request", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} title={t("Return or replace")} onClose={onClose}>
      <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["RETURN", "REPLACEMENT"] as const).map((k) => (
            <Pressable key={k} onPress={() => setType(k)} style={[styles.typeBtn, type === k && styles.typeBtnOn]} accessibilityRole="radio" accessibilityState={{ checked: type === k }}>
              <T w="semibold" size={13}>{t(k === "RETURN" ? "Return for refund" : "Replace item")}</T>
              <T size={11} color={C.muted}>{t(k === "RETURN" ? "Get your money back" : "Get the same item again")}</T>
            </Pressable>
          ))}
        </View>

        <T w="semibold" size={13} style={{ marginTop: 14 }}>{t("Which items?")}</T>
        {order.items.map((i) => (
          <Pressable key={i.id} onPress={() => setSelected({ ...selected, [i.id]: !selected[i.id] })} style={styles.itemPick} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(selected[i.id]) }}>
            <Feather name={selected[i.id] ? "check-square" : "square"} size={18} color={selected[i.id] ? C.brandDark : C.faint} />
            <View style={styles.thumb}>{i.productImage ? <CachedImage source={i.productImage} style={FILL} contentFit="cover" /> : null}</View>
            <View style={{ flex: 1 }}>
              <T size={12} numberOfLines={2}>{i.productTitle ?? "Item"}</T>
              {i.isReturnable === false ? <T size={10} color={C.muted}>{t("Non-returnable")}</T> : null}
            </View>
          </Pressable>
        ))}

        <T w="semibold" size={13} style={{ marginTop: 14 }}>{t("Reason")}</T>
        {RETURN_REASONS.map((r) => <RadioRow key={r.code} label={t(r.label)} selected={reasonCode === r.code} onPress={() => setReasonCode(r.code)} />)}
        {blocked ? <T size={11} color="#92400E">{t("Non-returnable items can come back only if wrong, damaged, defective or incomplete.")}</T> : null}

        <TextInput value={details} onChangeText={setDetails} multiline maxLength={500} placeholder={t("Describe the problem (optional)")} placeholderTextColor={C.faint} style={styles.textArea} />

        <T w="semibold" size={13} style={{ marginTop: 14 }}>{t("Photos")}{reason?.needsPhoto ? " *" : ""}</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {photos.map((p) => (
            <Pressable key={p} onPress={() => setPhotos(photos.filter((x) => x !== p))} style={styles.thumbLg} accessibilityLabel={t("Remove photo")}>
              <CachedImage source={p} style={FILL} contentFit="cover" />
            </Pressable>
          ))}
          {photos.length < 6 ? (
            <Pressable onPress={() => void addPhoto()} style={[styles.thumbLg, styles.addPhoto]} accessibilityRole="button" accessibilityLabel={t("Add photo")}>
              <Feather name={uploading ? "loader" : "camera"} size={18} color={C.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.pickupBox, { marginTop: 14 }]}>
          <T size={11} color={C.muted}>
            {t("After approval a courier picks the item up from your delivery address. Keep it unused, with tags and original packaging.")}{" "}
            {type === "RETURN"
              ? t(order.paymentMethod === "COD" ? "COD refunds go to the bank / UPI details in your account." : "The refund goes to your original payment method once the item is received.")
              : t("The replacement is sent once the item is picked up (or refunded if it is out of stock).")}
          </T>
        </View>
        <PrimaryBtn label="Submit request" onPress={() => void submit()} loading={sending || uploading} style={{ marginTop: 12 }} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: C.border },
  banner: { borderRadius: 12, padding: 14, marginTop: 12 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.border, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  line: { width: 2, flex: 1, backgroundColor: C.border, marginVertical: 2 },
  shipBox: { marginTop: 12, backgroundColor: C.bg, borderRadius: 10, padding: 10, gap: 2 },
  refundRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginBottom: 8 },
  returnBox: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginBottom: 10, gap: 4 },
  pickupBox: { backgroundColor: C.bg, borderRadius: 8, padding: 8, gap: 2, marginTop: 4 },
  textArea: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, minHeight: 64, marginTop: 8, color: C.text, textAlignVertical: "top", backgroundColor: C.card },
  typeBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  typeBtnOn: { borderColor: C.brandDark, backgroundColor: C.brandSoft },
  itemPick: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  thumb: { width: 40, height: 48, borderRadius: 6, overflow: "hidden", backgroundColor: C.divider },
  thumbLg: { width: 60, height: 60, borderRadius: 8, overflow: "hidden", backgroundColor: C.divider },
  addPhoto: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: C.border },
});
