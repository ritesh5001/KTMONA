import * as React from "react";
import { Feather } from "@expo/vector-icons";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { Image } from "../../src/components/CompatImage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, typography, shadow } from "../../src/theme/tokens";
import { FieldLabel } from "../../src/components/FieldLabel";
import { flushPendingCartWrite } from "../../src/lib/pending-cart";
import { checkoutWithPayment, getCheckoutQuote, validateCoupon, type CheckoutQuote, type CouponPreview } from "../../src/services/cart";
import { initiatePayment } from "../../src/services/payments";
import { getCodConfig } from "../../src/services/extras";
import { useQuery } from "@tanstack/react-query";
import { useT } from "../../src/i18n";
import { confirmRazorpayPayment, openRazorpayCheckout } from "../../src/services/razorpay-sdk";
import { ApiError } from "../../src/services/api";
import { useAuth } from "../../src/hooks/useAuth";
import { useNetworkStatus } from "../../src/hooks/useNetworkStatus";
import { useCart } from "@/src/providers/CartProvider";
import { useAddresses } from "../../src/providers/AddressProvider";
import { useToast } from "../../src/providers/ToastProvider";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { notifySuccess, notifyError, impactLight } from "../../src/utils/haptics";
import { AppHeader } from "../../src/components/AppHeader";
import type { Address } from "../../src/services/addresses";
import { BrandLoader, BrandOverlayLoader } from "../../src/components/BrandLoader";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../src/components";
import {
  getShippingConfig,
  getGstConfig,
  getCachedShippingConfig,
  getCachedGstConfig,
} from "../../src/services/shipping";

// ---------------------------------------------------------------------------
// Address selector row — memoized for FlatList
// ---------------------------------------------------------------------------

interface SelectorRowProps {
  item: Address;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const AddressSelectorRow = React.memo(function AddressSelectorRow({
  item,
  isSelected,
  onSelect,
}: SelectorRowProps) {
  return (
    <AnimatedPressable
      style={[styles.selectorRow, isSelected && styles.selectorRowSelected]}
      onPress={() => onSelect(item.id)}
    >
      <View style={styles.selectorRadio}>
        {isSelected && <View style={styles.selectorRadioInner} />}
      </View>
      <View style={styles.selectorContent}>
        <View style={styles.selectorBadgeRow}>
          <Text style={styles.selectorLabel}>{item.label}</Text>
          {item.isDefault && (
            <Text style={styles.selectorDefault}>Default</Text>
          )}
        </View>
        <Text style={styles.selectorLine}>
          {item.addressLine1}
          {item.addressLine2 ? `, ${item.addressLine2}` : ""}
        </Text>
        <Text style={styles.selectorLine}>
          {item.city}, {item.state} — {item.pincode}
        </Text>
      </View>
    </AnimatedPressable>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CheckoutScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const routeParams = useLocalSearchParams<{
    buyNowVariantId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.accessToken ?? null;
  const { isConnected } = useNetworkStatus();
  const { clearCart, refreshCart, cartItems: allCartItems } = useCart();
  const { addresses, defaultAddress } = useAddresses();
  // Buy-now scopes this checkout to a single variant; the rest of the cart is
  // left untouched and is still there afterwards.
  const buyNowVariantId =
    typeof routeParams.buyNowVariantId === "string" && routeParams.buyNowVariantId
      ? routeParams.buyNowVariantId
      : null;

  // Buy-now shows and charges for just that item. Falls back to the whole cart if
  // the variant is somehow no longer present, rather than rendering an empty page.
  const cartItems = React.useMemo(() => {
    if (!buyNowVariantId) return allCartItems;
    const scoped = allCartItems.filter(
      (item) => item.variantId === buyNowVariantId
    );
    return scoped.length > 0 ? scoped : allCartItems;
  }, [allCartItems, buyNowVariantId]);
  const { showToast } = useToast();

  // ---------- Payment guard — prevents double-submit ----------
  const [isPaying, setIsPaying] = React.useState(false);
  const [payLabel, setPayLabel] = React.useState("Placing order");
  const [error, setError] = React.useState<string | null>(null);
  // Totals shown here are the pre-checkout estimate; the backend order is the
  // source of truth. We navigate away after placing the order.
  const [taxSummary] = React.useState<{
    subTotalAmount: number;
    totalTaxAmount: number;
    grandTotal: number;
    discountAmount: number;
  } | null>(null);
  const mountedRef = React.useRef(true);

  // ---------- Shipping / GST charge config (admin-controlled) ----------
  // Defaults to the flat fees so the estimate matches historical behaviour
  // until the config resolves; the backend is always the source of truth.
  const [shippingConfig, setShippingConfig] = React.useState<{
    enabled: boolean;
    amount: number;
  }>({ enabled: true, amount: 180 });
  const [gstConfig, setGstConfig] = React.useState<{
    enabled: boolean;
    amount: number;
  }>({ enabled: true, amount: 180 });

  React.useEffect(() => {
    const controller = new AbortController();
    // Paint from the last known values so the total is right on first frame,
    // then reconcile with the network.
    void getCachedShippingConfig().then((cached) => {
      if (cached && mountedRef.current) setShippingConfig(cached);
    });
    void getCachedGstConfig().then((cached) => {
      if (cached && mountedRef.current) setGstConfig(cached);
    });
    getShippingConfig(controller.signal)
      .then((config) => {
        if (mountedRef.current) setShippingConfig(config);
      })
      .catch(() => {
        // Non-fatal: keep the default estimate. The order total from the
        // backend still reflects the real charge.
      });
    getGstConfig(controller.signal)
      .then((config) => {
        if (mountedRef.current) setGstConfig(config);
      })
      .catch(() => {
        // Non-fatal: keep the default estimate.
      });
    return () => controller.abort();
  }, []);

  // ---------- Coupon state ----------
  const [couponCode, setCouponCode] = React.useState("");
  const [appliedCoupon, setAppliedCoupon] = React.useState<CouponPreview | null>(null);
  const [couponLoading, setCouponLoading] = React.useState(false);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const cartFingerprintRef = React.useRef("");

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------- Address selection ----------
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  const [showAddressModal, setShowAddressModal] = React.useState(false);

  // Auto-select a delivery address so a returning shopper never has to pick one.
  // Falls back to the first saved address: plenty of accounts have addresses but
  // none flagged default, and those users were being stopped at an empty picker.
  React.useEffect(() => {
    if (selectedAddressId) return;
    const auto = defaultAddress ?? addresses[0];
    if (auto) setSelectedAddressId(auto.id);
  }, [selectedAddressId, defaultAddress, addresses]);

  const selectedAddress = React.useMemo(
    () => addresses.find((a) => a.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  // ---------- Fallback manual shipping fields (if no addresses) ----------
  const [shipping, setShipping] = React.useState({
    name: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    pincode: "",
    notes: "",
  });

  const hasAddresses = addresses.length > 0;
  const cartSubtotal = React.useMemo(
    () => cartItems.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0),
    [cartItems]
  );
  const shippingFee =
    cartItems.length && shippingConfig.enabled ? shippingConfig.amount : 0;
  const gstFee =
    cartItems.length && gstConfig.enabled ? gstConfig.amount : 0;
  const displaySubtotal = taxSummary?.subTotalAmount ?? cartSubtotal;
  const displayDiscount = taxSummary?.discountAmount ?? 0;
  const computedGrandTotal = displaySubtotal - displayDiscount + shippingFee + gstFee;

  // The server quote is exactly what Place Order charges (coupon, GST, delivery,
  // free-delivery offer). The local numbers above only fill the first frame.
  const [quote, setQuote] = React.useState<CheckoutQuote | null>(null);
  const [useWallet, setUseWallet] = React.useState(false);
  const quoteKey = `${cartItems.map((i) => `${i.variantId}:${i.quantity}`).join("|")}#${appliedCoupon?.code ?? ""}#${buyNowVariantId ?? ""}#${useWallet}`;
  React.useEffect(() => {
    if (!token || cartItems.length === 0) return;
    let active = true;
    const t = setTimeout(() => {
      getCheckoutQuote({
        ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
        ...(buyNowVariantId ? { variantIds: [buyNowVariantId] } : {}),
        useWallet,
      })
        .then((q) => {
          if (!active) return;
          setQuote(q);
          if (appliedCoupon && q.couponError) {
            setCouponError(q.couponError);
            setAppliedCoupon(null);
          }
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, quoteKey]);

  const displayGrandTotal =
    quote?.total ??
    (typeof taxSummary?.grandTotal === "number"
      ? Math.max(taxSummary.grandTotal, computedGrandTotal)
      : computedGrandTotal);

  // One key per visit to checkout: a retried or double-tapped Place Order returns
  // the same order instead of creating a second one.
  const checkoutKey = React.useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

  // ---------- Clear coupon when cart items change ----------
  React.useEffect(() => {
    const fp = cartItems.map((i) => `${i.variantId}:${i.quantity}`).sort().join("|");
    if (cartFingerprintRef.current && cartFingerprintRef.current !== fp) {
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponError(null);
    }
    cartFingerprintRef.current = fp;
  }, [cartItems]);

  // Redirect if cart is empty (navigated directly, or cart cleared)
  React.useEffect(() => {
    if (!authLoading && cartItems.length === 0 && !isPaying) {
      // Don't redirect while a payment is in-flight
      // Cart will be empty after successful checkout → we navigate from handleCheckout
    }
  }, [authLoading, cartItems.length, isPaying]);

  React.useEffect(() => {
    if (!authLoading && !token) {
      const returnTo = encodeURIComponent(pathname || "/checkout");
      router.replace(`/login?returnTo=${returnTo}`);
    }
  }, [authLoading, token, pathname, router]);

  // ---- Address modal handlers ----

  const openAddressModal = React.useCallback(() => {
    impactLight();
    setShowAddressModal(true);
  }, []);

  const closeAddressModal = React.useCallback(() => {
    setShowAddressModal(false);
  }, []);

  const handleSelectAddress = React.useCallback((id: string) => {
    impactLight();
    setSelectedAddressId(id);
    setShowAddressModal(false);
  }, []);

  const navigateToAddAddress = React.useCallback(() => {
    setShowAddressModal(false);
    router.push("/profile/addresses/form");
  }, [router]);

  // ---- Coupon handlers ----

  const handleApplyCoupon = React.useCallback(async () => {
    const trimmed = couponCode.trim();
    if (!trimmed || !token) return;

    setCouponLoading(true);
    setCouponError(null);

    try {
      const result = await validateCoupon(trimmed, token);
      if (result.valid && result.coupon) {
        // Client-side min-order hint (backend is source of truth at checkout)
        const subtotal = cartItems.reduce(
          (sum, i) => sum + i.priceSnapshot * i.quantity,
          0
        );
        if (
          result.coupon.minOrderAmount !== null &&
          subtotal < result.coupon.minOrderAmount
        ) {
          setCouponError(
            `Minimum order of ₹${result.coupon.minOrderAmount} required`
          );
          setCouponLoading(false);
          return;
        }

        setAppliedCoupon(result.coupon);
        setCouponError(null);
        impactLight();
      } else {
        setCouponError(result.message ?? "Invalid coupon code");
        notifyError();
      }
    } catch (err) {
      setCouponError(
        err instanceof Error ? err.message : "Could not validate coupon"
      );
      notifyError();
    } finally {
      setCouponLoading(false);
    }
  }, [couponCode, token, cartItems]);

  const handleRemoveCoupon = React.useCallback(() => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
    impactLight();
  }, []);

  // ---- Checkout handler ----

  /* Cash on Delivery (Meesho's default payment): offered when the admin has
     it switched on and the order is within the courier cash limit. */
  const t = useT();
  const [paymentMethod, setPaymentMethod] = React.useState<"ONLINE" | "COD">("ONLINE");
  const codQ = useQuery({ queryKey: ["config", "cod"], queryFn: ({ signal }) => getCodConfig(signal), staleTime: 5 * 60 * 1000 });
  const codAllowed = quote
    ? quote.cod.available
    : Boolean(codQ.data?.enabled) && displayGrandTotal <= (codQ.data?.maxOrderAmount ?? 0);
  React.useEffect(() => {
    if (paymentMethod === "COD" && !codAllowed) setPaymentMethod("ONLINE");
  }, [codAllowed, paymentMethod]);

  const handleCheckout = async () => {
    // --- Guard: prevent double submit ---
    if (isPaying) return;
    if (authLoading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!isConnected) {
      Alert.alert(
        "No connection",
        "You appear to be offline. Please reconnect before completing your order."
      );
      return;
    }
    if (cartItems.length === 0) {
      showToast("Your cart is empty.", "info");
      return;
    }

    // These are the fields an order genuinely cannot ship without — the ones marked
    // with a red asterisk. Nothing was validated before, so an order could be placed
    // with no recipient, no address and no pincode at all.
    if (!selectedAddress) {
      const missing = (
        [
          ["Full name", shipping.name],
          ["Phone", shipping.phone],
          ["Address line 1", shipping.addressLine1],
          ["City", shipping.city],
          ["Pincode", shipping.pincode],
        ] as const
      )
        .filter(([, value]) => !value?.trim())
        .map(([field]) => field);

      if (missing.length > 0) {
        showToast(`Please fill in: ${missing.join(", ")}`, "info");
        return;
      }

      if (!/^\d{6}$/.test(shipping.pincode.trim())) {
        showToast("Please enter a valid 6-digit pincode", "info");
        return;
      }
    }

    // Build shipping payload from selected address or manual fields.
    // The saved-address branch previously sent only the address lines and city —
    // no recipient name, no phone and no pincode — which left those orders
    // effectively undeliverable.
    const shippingPayload = selectedAddress
      ? {
          shippingName: shipping.name?.trim() || undefined,
          shippingPhone: shipping.phone?.trim() || undefined,
          shippingEmail: shipping.email?.trim() || undefined,
          shippingAddressLine1: selectedAddress.addressLine1,
          shippingAddressLine2: selectedAddress.addressLine2 || undefined,
          shippingCity: selectedAddress.city,
          shippingPincode: selectedAddress.pincode || undefined,
          shippingNotes: shipping.notes?.trim() || undefined,
          couponCode: appliedCoupon?.code || undefined,
        }
      : {
          shippingName: shipping.name || undefined,
          shippingPhone: shipping.phone || undefined,
          shippingEmail: shipping.email || undefined,
          shippingAddressLine1: shipping.addressLine1 || undefined,
          shippingAddressLine2: shipping.addressLine2 || undefined,
          shippingCity: shipping.city || undefined,
          shippingPincode: shipping.pincode || undefined,
          shippingNotes: shipping.notes || undefined,
          couponCode: appliedCoupon?.code || undefined,
        };

    setPayLabel("Placing order");
    setIsPaying(true);
    setError(null);

    try {
      // Buy Now navigates here while its add-to-cart may still be in flight.
      // Without this the order could race ahead of it and fail with "Cart is empty".
      await flushPendingCartWrite();

      // 1. Place the order AND start the Razorpay payment in ONE request. Doing
      //    these as two sequential calls meant the buyer waited for two full
      //    round-trips before the payment sheet opened.
      const orderResult = await checkoutWithPayment(
        {
          ...shippingPayload,
          ...(buyNowVariantId ? { variantIds: [buyNowVariantId] } : {}),
          paymentMethod,
          checkoutKey: checkoutKey.current,
          ...(useWallet ? { useWallet: true } : {}),
        },
        token
      );
      const orderId = orderResult.order?.id;
      if (!orderId) {
        throw new Error("Order ID missing. Please try again.");
      }

      // Cash on Delivery: the order is already confirmed — no payment step.
      if (orderResult.paymentMethod === "COD") {
        notifySuccess();
        if (!buyNowVariantId) clearCart();
        showToast(t("Order placed! Pay in cash when it's delivered."), "success");
        router.replace(`/orders/${orderId}?placed=1`);
        setTimeout(() => {
          void refreshCart();
        }, 0);
        return;
      }

      if (!orderResult.payment && orderResult.paymentInitError) {
        throw new Error(orderResult.paymentInitError);
      }

      setPayLabel("Opening payment");
      const payment = orderResult.payment ?? (await initiatePayment(orderId, token)).data;
      const sdkResult = await openRazorpayCheckout(payment);

      if (!mountedRef.current) return;

      if (sdkResult.status === "paid") {
        // The SDK saying "paid" is the buyer finishing the flow; the server is
        // the authority on whether the money settled.
        setPayLabel("Confirming payment");
        const outcome = await confirmRazorpayPayment(orderId, token, sdkResult);
        if (!mountedRef.current) return;

        if (outcome === "SUCCESS") {
          notifySuccess();
          // Only a full-cart checkout empties the cart. The backend deletes just
          // the purchased rows on a buy-now and deliberately leaves the rest, so
          // clearing locally here would blank items the shopper still owns and
          // rely on the refresh below to put them back — a visible flash at best,
          // and a cart that looks wiped until the next refresh if that call
          // fails. The refresh alone is correct for buy-now: it reads the cart
          // the server actually kept.
          if (!buyNowVariantId) {
            clearCart();
          }
          showToast("Payment successful. Order confirmed.", "success");
          router.replace(`/orders/${orderId}?placed=1`);
          setTimeout(() => {
            void refreshCart();
          }, 0);
          return;
        }

        // Paid but not settled yet — the webhook will confirm it.
        showToast("Payment pending. Check your orders for the final status.", "info");
        router.replace(`/orders/${orderId}?placed=1`);
        return;
      }

      if (sdkResult.status === "failed") {
        setError(`Payment failed: ${sdkResult.error} You can retry from your orders.`);
        notifyError();
        showToast("Payment failed. Retry from orders.", "error");
        router.replace(`/orders/${orderId}?placed=1`);
        return;
      }

      // The buyer closed the sheet. The order exists and is unpaid — send them
      // to it so they can retry rather than leaving them on a dead spinner.
      setError("Payment was cancelled. You can retry from your orders.");
      showToast("Payment cancelled.", "info");
      router.replace(`/orders/${orderId}?placed=1`);
    } catch (err) {
      if (!mountedRef.current) return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Checkout failed. Please try again.";
      setError(message);
      notifyError();
      showToast(message, "error");
    } finally {
      if (mountedRef.current) {
        setIsPaying(false);
        setPayLabel("Placing order");
      }
    }
  };

  const isButtonDisabled =
    isPaying ||
    !isConnected ||
    cartItems.length === 0 ||
    (quote ? !quote.canPlaceOrder : false) ||
    (hasAddresses && !selectedAddressId);

  // Bottom bar is hidden on checkout, so only account for safe area + comfortable padding
  const checkoutBottomReserve = Math.max(insets.bottom, spacing.sm) + spacing.xl;

  // ---- Selector key ----
  const selectorKeyExtractor = React.useCallback(
    (item: Address) => item.id,
    [],
  );

  const renderSelectorItem = React.useCallback(
    ({ item }: { item: Address }) => (
      <AddressSelectorRow
        item={item}
        isSelected={item.id === selectedAddressId}
        onSelect={handleSelectAddress}
      />
    ),
    [selectedAddressId, handleSelectAddress],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title="Checkout" subtitle="Secure payment" showBack />
      {isPaying ? (
        <BrandOverlayLoader label={payLabel} />
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: checkoutBottomReserve }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.subtitle}>
          Confirm delivery address and complete your order.
        </Text>

        {/* ---- Address section ---- */}
        {hasAddresses ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>

            {selectedAddress ? (
              <View style={styles.selectedAddressBox}>
                <View style={styles.selectedBadgeRow}>
                  <Text style={styles.selectorLabel}>
                    {selectedAddress.label}
                  </Text>
                  {selectedAddress.isDefault && (
                    <Text style={styles.selectorDefault}>Default</Text>
                  )}
                </View>
                <Text style={styles.selectedLine}>
                  {selectedAddress.addressLine1}
                  {selectedAddress.addressLine2
                    ? `, ${selectedAddress.addressLine2}`
                    : ""}
                </Text>
                <Text style={styles.selectedLine}>
                  {selectedAddress.city}, {selectedAddress.state} —{" "}
                  {selectedAddress.pincode}
                </Text>
              </View>
            ) : (
              <Text style={styles.noAddressHint}>
                Select a delivery address to continue.
              </Text>
            )}

            <AnimatedPressable
              style={styles.changeButton}
              onPress={openAddressModal}
              disabled={isPaying}
            >
              <Text style={styles.changeButtonText}>
                {selectedAddress ? "Change address" : "Select address"}
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          /* ---- Fallback manual fields (no saved addresses) ---- */
          <View style={styles.card}>
            <View style={styles.noAddressCta}>
              <Text style={styles.noAddressCtaText}>
                Save addresses for faster checkout
              </Text>
              <AnimatedPressable
                style={styles.addAddressButton}
                onPress={navigateToAddAddress}
              >
                <Text style={styles.addAddressButtonText}>+ Add address</Text>
              </AnimatedPressable>
            </View>

            <FieldLabel required>Full name</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="Aarav Sharma"
              placeholderTextColor={colors.brownSoft}
              value={shipping.name}
              onChangeText={(value) =>
                setShipping((prev) => ({ ...prev, name: value }))
              }
              editable={!isPaying}
            />

            <FieldLabel required>Phone</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="+91 75033 04533"
              placeholderTextColor={colors.brownSoft}
              keyboardType="phone-pad"
              value={shipping.phone}
              onChangeText={(value) =>
                setShipping((prev) => ({ ...prev, phone: value }))
              }
              editable={!isPaying}
            />

            <FieldLabel>Email</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor={colors.brownSoft}
              autoCapitalize="none"
              value={shipping.email}
              onChangeText={(value) =>
                setShipping((prev) => ({ ...prev, email: value }))
              }
              editable={!isPaying}
            />

            <FieldLabel required>Address line 1</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="House, street, area"
              placeholderTextColor={colors.brownSoft}
              value={shipping.addressLine1}
              onChangeText={(value) =>
                setShipping((prev) => ({ ...prev, addressLine1: value }))
              }
              editable={!isPaying}
            />

            <FieldLabel>Address line 2</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="Apartment, landmark"
              placeholderTextColor={colors.brownSoft}
              value={shipping.addressLine2}
              onChangeText={(value) =>
                setShipping((prev) => ({ ...prev, addressLine2: value }))
              }
              editable={!isPaying}
            />

            <FieldLabel required>City</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor={colors.brownSoft}
              value={shipping.city}
              onChangeText={(value) =>
                setShipping((prev) => ({ ...prev, city: value }))
              }
              editable={!isPaying}
            />

            <FieldLabel required>Pincode</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="6-digit pincode"
              placeholderTextColor={colors.brownSoft}
              keyboardType="number-pad"
              maxLength={6}
              value={shipping.pincode}
              onChangeText={(value) =>
                setShipping((prev) => ({
                  ...prev,
                  pincode: value.replace(/[^0-9]/g, ""),
                }))
              }
              editable={!isPaying}
            />
          </View>
        )}

        {/* ---- Notes (always visible) ---- */}
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <FieldLabel>Order notes (optional)</FieldLabel>
          <TextInput
            style={[styles.input, { height: 72, textAlignVertical: "top" }]}
            placeholder="Special instructions…"
            placeholderTextColor={colors.brownSoft}
            multiline
            value={shipping.notes}
            onChangeText={(value) =>
              setShipping((prev) => ({ ...prev, notes: value }))
            }
            editable={!isPaying}
          />
        </View>

        {/* ---- Coupon Card ---- */}
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>Promo Code</Text>

          {appliedCoupon ? (
            /* Applied state */
            <View style={styles.couponAppliedBox}>
              <View style={styles.couponAppliedLeft}>
                <Text style={styles.couponCheckmark}>✓</Text>
                <View>
                  <Text style={styles.couponAppliedCode}>{appliedCoupon.code}</Text>
                  <Text style={styles.couponAppliedDesc}>
                    {appliedCoupon.type === "PERCENT"
                      ? `${appliedCoupon.value}% off${
                          appliedCoupon.maxDiscountAmount !== null
                            ? ` (up to ₹${appliedCoupon.maxDiscountAmount})`
                            : ""
                        }`
                      : `₹${appliedCoupon.value} off`}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleRemoveCoupon}
                disabled={isPaying}
                hitSlop={12}
              >
                <Text style={styles.couponRemoveText}>REMOVE</Text>
              </Pressable>
            </View>
          ) : (
            /* Input state */
            <View style={styles.couponInputRow}>
              <TextInput
                style={[styles.input, styles.couponInput]}
                placeholder="Enter coupon code"
                placeholderTextColor={colors.brownSoft}
                autoCapitalize="characters"
                value={couponCode}
                onChangeText={(text) => {
                  setCouponCode(text.toUpperCase());
                  if (couponError) setCouponError(null);
                }}
                editable={!isPaying && !couponLoading}
                returnKeyType="done"
                onSubmitEditing={handleApplyCoupon}
              />
              <AnimatedPressable
                style={[
                  styles.couponApplyButton,
                  (couponLoading || !couponCode.trim()) && styles.buttonDisabled,
                ]}
                onPress={handleApplyCoupon}
                disabled={couponLoading || isPaying || !couponCode.trim()}
              >
                <Text style={styles.couponApplyText}>
                  {couponLoading ? "…" : "APPLY"}
                </Text>
              </AnimatedPressable>
            </View>
          )}

          {couponError ? (
            <Text style={styles.couponErrorText}>{couponError}</Text>
          ) : null}
        </View>

        {/* ---- Items being ordered ---- */}
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>
            {cartItems.length === 1 ? "1 item" : `${cartItems.length} items`}
            {buyNowVariantId ? " · Buying now" : ""}
          </Text>
          {cartItems.map((item, index) => {
            const thumbnail =
              item.variant?.images?.[0] ?? item.product?.images?.[0] ?? null;
            const compareAt = item.variant?.compareAtPrice;
            const hasDiscount =
              typeof compareAt === "number" && compareAt > item.priceSnapshot;
            return (
              <View
                key={item.id}
                style={[
                  styles.checkoutItemRow,
                  index === cartItems.length - 1 && styles.checkoutItemRowLast,
                ]}
              >
                {thumbnail ? (
                  <Image
                    source={{ uri: thumbnail }}
                    style={styles.checkoutItemImage}
                    contentFit="cover"
                    width={80}
                  />
                ) : (
                  <View style={[styles.checkoutItemImage, styles.checkoutItemImageFallback]}>
                    <Text style={styles.checkoutItemFallbackText}>
                      {(item.product?.title ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.checkoutItemInfo}>
                  <Text style={styles.checkoutItemTitle} numberOfLines={2}>
                    {item.product?.title ?? "Item"}
                  </Text>
                  <View style={styles.checkoutItemMetaRow}>
                    {item.variant?.colorHex ? (
                      <View
                        style={[
                          styles.checkoutColorDot,
                          { backgroundColor: item.variant.colorHex },
                        ]}
                      />
                    ) : null}
                    <Text style={styles.checkoutItemMeta} numberOfLines={1}>
                      {item.variant?.color ? `${item.variant.color} · ` : ""}
                      Size {item.variant?.size ?? "Default"} · Qty {item.quantity}
                    </Text>
                  </View>
                  <View style={styles.checkoutItemPriceRow}>
                    <Text style={styles.checkoutItemPrice}>
                      ₹{(item.priceSnapshot * item.quantity).toFixed(0)}
                    </Text>
                    {hasDiscount ? (
                      <Text style={styles.checkoutItemCompareAt}>
                        ₹{((compareAt as number) * item.quantity).toFixed(0)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ---- Order Summary ---- */}
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {quote ? (
            <>
              {quote.freeDelivery && !quote.freeDelivery.eligible ? (
                <Text style={[styles.summaryLabel, { marginBottom: spacing.xs }]}>
                  {t("Add")} ₹{quote.freeDelivery.remaining.toFixed(0)} {t("more for FREE delivery")}
                </Text>
              ) : null}
              <SummaryLine label={`Price (${quote.itemCount} item${quote.itemCount === 1 ? "" : "s"})`} value={`₹${quote.mrpTotal.toFixed(0)}`} />
              {quote.productDiscount > 0 ? <SummaryLine label="Discount on MRP" value={`−₹${quote.productDiscount.toFixed(0)}`} good /> : null}
              {quote.coupon ? <SummaryLine label={`${quote.coupon.auto ? "Offer applied" : "Coupon"} (${quote.coupon.code})`} value={`−₹${quote.coupon.discount.toFixed(0)}`} good /> : null}
              {(quote.autoDiscounts ?? []).map((d) => <SummaryLine key={d.key} label={d.label} value={`−₹${d.amount.toFixed(0)}`} good />)}
              <SummaryLine label="Delivery" value={quote.shipping === 0 ? "FREE" : `₹${quote.shipping.toFixed(0)}`} good={quote.shipping === 0} />
              {quote.gst > 0 ? <SummaryLine label="GST" value={`₹${quote.gst.toFixed(0)}`} /> : null}
              {quote.gstFee > 0 ? <SummaryLine label="GST charges" value={`₹${quote.gstFee.toFixed(0)}`} /> : null}
              {quote.wallet && quote.wallet.applied > 0 ? <SummaryLine label="Cashback used" value={`−₹${quote.wallet.applied.toFixed(0)}`} good /> : null}
              {quote.wallet && quote.wallet.available > 0 ? (
                <Pressable
                  onPress={() => setUseWallet((v) => !v)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xs, paddingVertical: 6 }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: useWallet }}
                >
                  <Feather name={useWallet ? "check-square" : "square"} size={20} color={useWallet ? colors.gold : colors.brownSoft} />
                  <Text style={styles.summaryLabel}>
                    {t("Use cashback")} ₹{quote.wallet.usable.toFixed(0)} ({t("balance")} ₹{quote.wallet.available.toFixed(0)})
                  </Text>
                </Pressable>
              ) : null}
              {quote.issues.length ? (
                <Text style={[styles.summaryLabel, { color: "#B45309", marginTop: spacing.xs }]}>
                  {quote.issues.map((i) => i.message).join("\n")}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.summaryLabel}>Calculating…</Text>
          )}
          <View style={[styles.summaryRow, { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft }]}>
            <Text style={[styles.summaryLabel, { fontFamily: typography.sansMedium, color: colors.charcoal }]}>Total payable</Text>
            <Text style={[styles.summaryValue, { fontFamily: typography.serif, fontSize: 18, color: colors.charcoal }]}>₹{displayGrandTotal.toFixed(0)}</Text>
          </View>
          {quote && quote.savings > 0 ? (
            <Text style={[styles.summaryLabel, { color: "#065F46", marginTop: spacing.xs }]}>
              {t("You save")} ₹{quote.savings.toFixed(0)} {t("on this order")}
            </Text>
          ) : null}
          <Text style={[styles.summaryLabel, { fontSize: 11, marginTop: spacing.xs }]}>
            {t("This is the final amount, including GST and delivery.")}
          </Text>
        </View>

        {/* ---- Payment method ---- */}
        <View style={styles.card}>
          <Text style={[styles.summaryLabel, { fontFamily: typography.sansMedium, color: colors.charcoal, marginBottom: spacing.sm }]}>Payment method</Text>
          {([
            { key: "ONLINE" as const, title: "Pay online", hint: "UPI, cards, net banking and wallets via Razorpay", enabled: true },
            ...(codQ.data?.enabled
              ? [{
                  key: "COD" as const,
                  title: "Cash on Delivery",
                  hint: codAllowed
                    ? "Pay in cash or UPI to the delivery partner"
                    : `${t("Available for orders up to")} ₹${(codQ.data?.maxOrderAmount ?? 0).toLocaleString("en-IN")}`,
                  enabled: codAllowed,
                }]
              : []),
          ]).map((opt) => {
            const on = paymentMethod === opt.key;
            return (
              <Pressable
                key={opt.key}
                disabled={!opt.enabled || isPaying}
                onPress={() => setPaymentMethod(opt.key)}
                style={[styles.payOption, on && styles.payOptionOn, !opt.enabled && { opacity: 0.5 }]}
              >
                <View style={[styles.payRadio, on && styles.payRadioOn]}>{on ? <View style={styles.payRadioDot} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payTitle}>{opt.title}</Text>
                  <Text style={styles.payHint}>{opt.hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ---- CTA ---- */}
        <AnimatedPressable
          style={[
            styles.primaryButton,
            isButtonDisabled && styles.buttonDisabled,
          ]}
          onPress={handleCheckout}
          disabled={isButtonDisabled}
          hitSlop={10}
        >
          {isPaying ? (
            <BrandLoader size="sm" color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {!isConnected
                ? "Offline"
                : cartItems.length === 0
                  ? "Cart is empty"
                  : hasAddresses && !selectedAddressId
                    ? "Select address"
                    : paymentMethod === "COD"
                      ? "Place Order"
                      : "Proceed to Payment"}
            </Text>
          )}
        </AnimatedPressable>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </ScrollView>

      {/* ---- Address selector modal ---- */}
      <Modal
        visible={showAddressModal}
        transparent
        animationType="slide"
        onRequestClose={closeAddressModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Address</Text>

            <FlatList
              data={addresses}
              keyExtractor={selectorKeyExtractor}
              renderItem={renderSelectorItem}
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.modalFooter}>
              <AnimatedPressable
                style={styles.addAddressButton}
                onPress={navigateToAddAddress}
              >
                <Text style={styles.addAddressButtonText}>
                  + Add new address
                </Text>
              </AnimatedPressable>
              <Pressable
                style={styles.modalCloseButton}
                onPress={closeAddressModal}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  payOption: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  payOptionOn: { borderColor: "#B84A00", backgroundColor: "#FFF1E0" },
  payRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderSoft, alignItems: "center", justifyContent: "center" },
  payRadioOn: { borderColor: "#B84A00" },
  payRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#B84A00" },
  payTitle: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.charcoal },
  payHint: { fontFamily: typography.sans, fontSize: 12, color: colors.brownSoft, marginTop: 2 },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
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
  sectionTitle: {
    fontFamily: typography.serif,
    fontSize: 16,
    color: colors.charcoal,
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1.2,
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

  // Payment method selector
  payMethodRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  payMethodOption: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  payMethodOptionFull: {
    flex: undefined,
    marginTop: spacing.sm,
  },
  payMethodOptionSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceElevated,
  },
  payMethodTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.charcoal,
  },
  payMethodDesc: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
  },

  // Selected address display
  selectedAddressBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  selectedBadgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  selectedLine: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.charcoal,
    marginTop: 2,
    lineHeight: 19,
  },
  noAddressHint: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.brownSoft,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  changeButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
  },
  changeButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.gold,
  },

  // No address CTA
  noAddressCta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  noAddressCtaText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    flex: 1,
    marginRight: spacing.sm,
  },
  addAddressButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  addAddressButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.gold,
  },

  // Primary button
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.background,
  },
  errorText: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gold,
    textAlign: "center",
  },

  // Address selector modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.md,
    backgroundColor: colors.borderSoft,
    alignSelf: "center",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: typography.serif,
    fontSize: 20,
    color: colors.charcoal,
    marginBottom: spacing.md,
  },
  modalList: {
    flexGrow: 0,
  },
  modalFooter: {
    marginTop: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  modalCloseButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalCloseText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.brownSoft,
  },

  // Selector rows
  selectorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  selectorRowSelected: {
    borderColor: colors.gold,
    backgroundColor: "rgba(184, 149, 108, 0.14)",
  },
  selectorRadio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  selectorRadioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  selectorContent: {
    flex: 1,
  },
  selectorBadgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: 3,
  },
  selectorLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.gold,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  selectorDefault: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.gold,
    backgroundColor: "rgba(184, 149, 108, 0.14)",
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  selectorLine: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    marginTop: 1,
    lineHeight: 17,
  },

  // Order summary (GST breakdown)
  checkoutItemRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  checkoutItemRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  checkoutItemImage: {
    width: 64,
    height: 80,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  checkoutItemImageFallback: { alignItems: "center", justifyContent: "center" },
  checkoutItemFallbackText: {
    fontFamily: typography.serif,
    fontSize: 22,
    color: colors.brownSoft,
  },
  checkoutItemInfo: { flex: 1, justifyContent: "center" },
  checkoutItemTitle: {
    fontFamily: typography.serif,
    fontSize: 15,
    lineHeight: 20,
    color: colors.charcoal,
  },
  checkoutItemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  checkoutColorDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  checkoutItemMeta: {
    flex: 1,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },
  checkoutItemPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginTop: 6,
  },
  checkoutItemPrice: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.charcoal,
  },
  checkoutItemCompareAt: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textDecorationLine: "line-through",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  summaryLabel: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.brownSoft,
  },
  summaryValue: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.charcoal,
  },

  // Coupon styles
  couponAppliedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.md,
  },
  couponAppliedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  couponCheckmark: {
    fontSize: 14,
    color: colors.gold,
    fontFamily: typography.sansMedium,
  },
  couponAppliedCode: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  couponAppliedDesc: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.goldMuted,
    marginTop: 1,
  },
  couponRemoveText: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.brownSoft,
  },
  couponInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  couponInput: {
    flex: 1,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 0,
  },
  couponApplyButton: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  couponApplyText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.gold,
  },
  couponErrorText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gold,
    marginTop: spacing.xs,
  },
});

function SummaryLine({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, good ? { color: "#047857" } : null]}>{value}</Text>
    </View>
  );
}
