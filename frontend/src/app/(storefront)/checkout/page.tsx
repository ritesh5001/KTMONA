"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkoutWithPayment, getCart, type CouponPreview } from "@/services/cart";
import { initiatePayment } from "@/services/payments";
import { ApiTimeoutError } from "@/services/api";
import { flushPendingCartWrite } from "@/lib/pending-cart";
import { getAddresses, type Address } from "@/services/addresses";
import { getShippingConfig } from "@/services/shipments";
import CouponSection from "@/components/checkout/CouponSection";
import FastrrCheckout, {
  notifyFastrrFallback,
} from "@/components/checkout/fastrr-checkout";
import { getCheckoutConfig } from "@/services/fastrr";
import { hasSession } from "@/lib/session";
import { loginUrlWithReturn } from "@/lib/login-redirect";
import { startNavigationFeedback } from "@/lib/navigation-feedback";
import { toast } from "sonner";
import {
  CHECKOUT_ADDRESSES_CACHE_KEY,
  CHECKOUT_ADDRESS_CACHE_TTL_MS,
  persistCheckoutCartSnapshot,
  readCheckoutCartSnapshot,
  clearCheckoutCartSnapshot,
} from "@/lib/checkout-snapshot";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/**
 * Which checkout the buyer sees.
 *
 * Every path into checkout — cart, Buy Now, quick-buy — lands on this route, so
 * it is the one place the express/native decision has to be made. The server
 * owns the flag; this only reads it, which means turning Fastrr off takes effect
 * for buyers already sitting on the page, without a deploy.
 *
 * `?express=off` forces the native flow. It is the fallbackUrl handed to Fastrr,
 * and the escape hatch behind "Use Standard Checkout".
 */
export default function CheckoutPage() {
  const router = useRouter();
  const [provider, setProvider] = React.useState<
    "LOADING" | "FASTRR" | "NATIVE"
  >("LOADING");

  React.useEffect(() => {
    /*
     * The session gate lives here, not in the proxy.
     *
     * A proxy redirect to /login is cached by the Next client Router Cache
     * against this URL, so once it was ever issued — a prefetch, or a genuine
     * bounce before the buyer signed in — every subsequent Buy Now / Proceed to
     * Checkout replayed it against a session that had since become valid. This
     * check runs on each mount instead, reads the cookies as they are right now,
     * and uses the same `hasSession()` the Buy Now button uses, so the two can
     * never disagree about whether the buyer is signed in.
     */
    if (!hasSession()) {
      toast.error("Please sign in to continue.");
      startNavigationFeedback();
      router.replace(loginUrlWithReturn());
      return;
    }

    // Read the flag from the URL directly rather than via useSearchParams: the
    // decision is already client-only, and useSearchParams would opt this whole
    // route out of prerendering unless wrapped in its own Suspense boundary.
    const forceNative =
      new URLSearchParams(window.location.search).get("express") === "off";

    if (forceNative) {
      setProvider("NATIVE");
      return;
    }

    let active = true;
    getCheckoutConfig()
      .then((config) => {
        if (active) setProvider(config.provider);
      })
      .catch(() => {
        // The config call is not worth failing checkout over. The native flow is
        // always safe to render, so an unreachable flag falls back to it.
        if (active) setProvider("NATIVE");
      });

    return () => {
      active = false;
    };
  }, [router]);

  const handleFallback = React.useCallback((reason: string) => {
    notifyFastrrFallback(reason);
    setProvider("NATIVE");
  }, []);

  if (provider === "LOADING") {
    return (
      <div className="min-h-[calc(100vh-160px)] bg-background" aria-busy="true" />
    );
  }

  if (provider === "FASTRR") {
    return <FastrrCheckout onFallback={handleFallback} />;
  }

  return <NativeCheckout />;
}

/**
 * The original address-form + PhonePe checkout. Still the fallback whenever
 * express checkout is off, unavailable, or declined by the buyer.
 */
function NativeCheckout() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [isPaying, setIsPaying] = React.useState(false);
  const [subtotal, setSubtotal] = React.useState(0);
  const [hasItems, setHasItems] = React.useState(false);
  // Shipping charge can be turned off by admins, so it is not known until
  // /v1/config/shipping resolves. Start at zero rather than assuming the flat fee:
  // guessing a charge shows the buyer a total higher than what they are actually
  // charged, which is exactly the kind of mismatch that erodes trust at checkout.
  // The backend order total remains the source of truth.
  const [shippingConfig, setShippingConfig] = React.useState<{
    enabled: boolean;
    amount: number;
  }>({ enabled: false, amount: 0 });

  const shippingFee = hasItems && shippingConfig.enabled ? shippingConfig.amount : 0;
  const cartTotal = subtotal + shippingFee;
  // Order totals shown here are the pre-checkout estimate; the backend order
  // is the source of truth. We navigate away on success, so no live update.
  const [taxSummary] = React.useState<{
    subTotalAmount: number;
    totalTaxAmount: number;
    grandTotal: number;
    discountAmount: number;
  } | null>(null);
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
  const [savedAddresses, setSavedAddresses] = React.useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);

  // ---- Coupon state ----
  const [appliedCoupon, setAppliedCoupon] = React.useState<CouponPreview | null>(null);
  const cartItemsRef = React.useRef<string>("");

  const applyCartSnapshot = React.useCallback(
    (items: Array<{ variantId: string; quantity: number; priceSnapshot: number }>) => {
      setHasItems(items.length > 0);
      const itemsSubtotal = items.reduce(
        (sum, item) => sum + item.priceSnapshot * item.quantity,
        0
      );
      setSubtotal(itemsSubtotal);

      const fingerprint = items
        .map((i) => `${i.variantId}:${i.quantity}`)
        .sort()
        .join("|");

      if (cartItemsRef.current && cartItemsRef.current !== fingerprint) {
        setAppliedCoupon(null);
      }
      cartItemsRef.current = fingerprint;
    },
    []
  );

  const applySavedAddresses = React.useCallback((addresses: Address[]) => {
    setSavedAddresses(addresses);

    const defaultAddr = addresses.find((address) => address.isDefault);
    if (!defaultAddr) {
      return;
    }

    setSelectedAddressId(defaultAddr.id);
    setShipping((prev) => ({
      ...prev,
      addressLine1: prev.addressLine1 || defaultAddr.addressLine1,
      addressLine2: prev.addressLine2 || defaultAddr.addressLine2 || "",
      city: prev.city || defaultAddr.city,
      pincode: prev.pincode || defaultAddr.pincode,
    }));
  }, []);

  React.useEffect(() => {
    let usedCachedAddresses = false;

    if (typeof window !== "undefined") {
      const cachedCartItems = readCheckoutCartSnapshot();
      if (cachedCartItems) {
        applyCartSnapshot(cachedCartItems);
      }

      const cachedAddresses = window.sessionStorage.getItem(
        CHECKOUT_ADDRESSES_CACHE_KEY
      );
      if (cachedAddresses) {
        try {
          const parsed = JSON.parse(cachedAddresses) as {
            at: number;
            addresses: Address[];
          };

          if (
            Date.now() - parsed.at < CHECKOUT_ADDRESS_CACHE_TTL_MS &&
            Array.isArray(parsed.addresses)
          ) {
            applySavedAddresses(parsed.addresses);
            usedCachedAddresses = true;
          }
        } catch {
          // Ignore malformed cache.
        }
      }
    }

    const loadCart = async () => {
      try {
        // Buy Now navigates here while its add-to-cart is still in flight.
        await flushPendingCartWrite();
        const cartResult = await getCart();
        const items = cartResult.cart.items ?? [];
        applyCartSnapshot(items);
        persistCheckoutCartSnapshot(items);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to load cart"
        );
      }
    };

    const loadAddresses = async () => {
      try {
        const addrResult = await getAddresses();
        applySavedAddresses(addrResult.addresses);

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            CHECKOUT_ADDRESSES_CACHE_KEY,
            JSON.stringify({
              at: Date.now(),
              addresses: addrResult.addresses,
            })
          );
        }
      } catch {
        if (!usedCachedAddresses) {
          setSavedAddresses([]);
        }
      }
    };

    void loadCart();
    void loadAddresses();
  }, [applyCartSnapshot, applySavedAddresses]);

  // Load the admin-controlled shipping-charge config for an accurate estimate.
  React.useEffect(() => {
    let active = true;
    getShippingConfig()
      .then((config) => {
        if (active) setShippingConfig(config);
      })
      .catch(() => {
        // Non-fatal: keep the default estimate. The backend order total still
        // reflects the real charge.
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCheckout = async () => {
    if (isPaying) return; // Prevent double-submit
    // These are the fields the order genuinely cannot ship without, and they are
    // the ones marked with a red asterisk. Only the pincode was previously checked,
    // so an order could be placed with no name or address at all.
    const missing = (
      [
        ["Full name", shipping.name],
        ["Phone", shipping.phone],
        ["Address", shipping.addressLine1],
        ["City", shipping.city],
        ["Pincode", shipping.pincode],
      ] as const
    )
      .filter(([, value]) => !value?.trim())
      .map(([field]) => field);

    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    if (!/^\d{6}$/.test(shipping.pincode.trim())) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }

    setLoading(true);
    setIsPaying(true);
    try {
      // Guarantee the Buy Now add-to-cart has landed. Without this the order could
      // race ahead of it and fail with "Cart is empty".
      await flushPendingCartWrite();

      // Place the order and initiate a PhonePe payment in one call.
      const orderResult = await checkoutWithPayment({
        shippingName: shipping.name || undefined,
        shippingPhone: shipping.phone || undefined,
        shippingEmail: shipping.email || undefined,
        shippingAddressLine1: shipping.addressLine1 || undefined,
        shippingAddressLine2: shipping.addressLine2 || undefined,
        shippingCity: shipping.city || undefined,
        shippingPincode: shipping.pincode || undefined,
        shippingNotes: shipping.notes || undefined,
        couponCode: appliedCoupon?.code || undefined,
      });

      const orderId = orderResult.order?.id;
      if (!orderId) {
        throw new Error("Order ID missing. Please try again.");
      }

      // If payment init failed at checkout time, surface the real reason and
      // retry once via the explicit initiate endpoint before giving up.
      if (!orderResult.payment && orderResult.paymentInitError) {
        throw new Error(orderResult.paymentInitError);
      }
      const payment =
        orderResult.payment ?? (await initiatePayment(orderId)).data;
      if (!payment.redirectUrl) {
        throw new Error("Payment could not be started. Please try again.");
      }

      // The server-side cart is now consumed. Drop the cached snapshot so a
      // Back-navigation can't re-enable this button and double-submit into a
      // "Cart is empty" error.
      clearCheckoutCartSnapshot();
      setHasItems(false);

      // PhonePe may drop our ?orderId= on the return redirect — stash it so the
      // callback can still confirm the payment.
      try {
        window.sessionStorage.setItem("ktmona_pending_order", orderId);
      } catch {
        // Non-fatal — the callback also accepts orderId via the query string.
      }

      // Redirect to PhonePe. Keep the button disabled (we're leaving the page).
      window.location.assign(payment.redirectUrl);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";

      // A timeout is NOT a failure — the server may have placed the order (and
      // consumed the cart) while we stopped listening. Re-submitting here is what
      // produced the "Cart is empty" error. Hand the buyer to their orders page,
      // where the pending order self-heals and offers Retry Payment.
      if (error instanceof ApiTimeoutError) {
        clearCheckoutCartSnapshot();
        toast.error(
          "The payment page took too long to open. Check your orders — if the order was placed, you can finish paying from there.",
          { duration: 10000 }
        );
        router.push("/user/orders");
        return;
      }

      if (/cart is empty/i.test(message)) {
        clearCheckoutCartSnapshot();
        toast.error("Your cart is empty. Check your orders for recent purchases.", {
          duration: 8000,
        });
        router.push("/user/orders");
        return;
      }

      toast.error(message, { duration: 8000 });
      setLoading(false);
      setIsPaying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16 lg:py-20"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Secure Checkout
          </p>
          <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
            Complete Your Order
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your pieces are reserved. Please provide delivery details to finalize your purchase.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-8">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center border-2 border-brand text-xs font-medium text-brand-strong">
              1
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-foreground">
              Details
            </span>
          </div>
          <div className="h-px w-12 bg-border-soft" />
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center border border-border-soft text-xs font-medium text-muted-foreground">
              2
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Payment
            </span>
          </div>
          <div className="h-px w-12 bg-border-soft" />
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center border border-border-soft text-xs font-medium text-muted-foreground">
              3
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Confirm
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr] lg:gap-16">
          {/* Shipping Form */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="space-y-8"
          >
            {/* Saved Address Picker */}
            {savedAddresses.length > 0 && (
              <div className="border border-border-soft bg-card p-8 space-y-6">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-strong mb-2">
                    Saved Addresses
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Select a saved address or enter a new one below.
                  </p>
                </div>
                <div className="h-px bg-border-soft" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {savedAddresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setSelectedAddressId(addr.id);
                          setShipping((prev) => ({
                            ...prev,
                            addressLine1: addr.addressLine1,
                            addressLine2: addr.addressLine2 ?? "",
                            city: addr.city,
                            pincode: addr.pincode,
                          }));
                        }}
                        className={`text-left p-4 border transition-all duration-300 ${
                          isSelected
                            ? "border-brand bg-brand/5"
                            : "border-border-soft hover:border-brand/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {addr.label}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[9px] font-medium uppercase tracking-wider text-[#5A7352]">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground">{addr.addressLine1}</p>
                        {addr.addressLine2 && (
                          <p className="text-xs text-muted-foreground">{addr.addressLine2}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {addr.city}, {addr.state} — {addr.pincode}
                        </p>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAddressId(null);
                      setShipping((prev) => ({
                        ...prev,
                        addressLine1: "",
                        addressLine2: "",
                        city: "",
                        pincode: "",
                      }));
                    }}
                    className={`text-left p-4 border transition-all duration-300 flex items-center justify-center ${
                      selectedAddressId === null
                        ? "border-brand bg-brand/5"
                        : "border-border-soft hover:border-brand/40"
                    }`}
                  >
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Enter New Address
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="border border-border-soft bg-card p-8 space-y-8">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-strong mb-2">
                  Delivery Address
                </p>
                <p className="text-sm text-muted-foreground">
                  Where shall we send your pieces?
                </p>
              </div>

              <div className="h-px bg-border-soft" />

              <div className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" required>Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Aarav Sharma"
                      value={shipping.name}
                      onChange={(event) =>
                        setShipping((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" required>Phone</Label>
                    <Input
                      id="phone"
                      placeholder="+91 87662 11837"
                      value={shipping.phone}
                      onChange={(event) =>
                        setShipping((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    placeholder="you@email.com"
                    value={shipping.email}
                    onChange={(event) =>
                      setShipping((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="h-px bg-border-soft" />

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="address" required>Address Line 1</Label>
                    <Input
                      id="address"
                      placeholder="House no, street"
                      value={shipping.addressLine1}
                      onChange={(event) =>
                        setShipping((prev) => ({
                          ...prev,
                          addressLine1: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode" required>Pincode</Label>
                    <Input
                      id="pincode"
                      placeholder="380001"
                      value={shipping.pincode}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) =>
                        setShipping((prev) => ({
                          ...prev,
                          pincode: event.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city" required>City</Label>
                    <Input
                      id="city"
                      placeholder="Ahmedabad"
                      value={shipping.city}
                      onChange={(event) =>
                        setShipping((prev) => ({
                          ...prev,
                          city: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address2">Address Line 2</Label>
                  <Input
                    id="address2"
                    placeholder="Apartment, landmark"
                    value={shipping.addressLine2}
                    onChange={(event) =>
                      setShipping((prev) => ({
                        ...prev,
                        addressLine2: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Delivery Notes (Optional)</Label>
                  <Input
                    id="notes"
                    placeholder="Preferred delivery timing, special instructions"
                    value={shipping.notes}
                    onChange={(event) =>
                      setShipping((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Coupon + Payment Summary */}
          <div className="lg:sticky lg:top-24 space-y-6">
            {/* Coupon Section */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
            >
              <CouponSection
                cartTotal={subtotal}
                appliedCoupon={appliedCoupon}
                onApply={setAppliedCoupon}
                onRemove={() => setAppliedCoupon(null)}
                disabled={isPaying || loading}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="border border-border-soft bg-card p-8 space-y-8"
            >
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  Payment Summary
                </p>
                <div className="h-px bg-border-soft" />
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{currency.format(taxSummary ? taxSummary.subTotalAmount : subtotal)}</span>
                </div>
                {/* Discount row — only after checkout response */}
                {taxSummary && taxSummary.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span>−{currency.format(taxSummary.discountAmount)}</span>
                  </div>
                )}
                {/* Coupon preview badge (before checkout) */}
                {!taxSummary && appliedCoupon && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span className="text-xs">
                      {appliedCoupon.type === "PERCENT"
                        ? `${appliedCoupon.value}% off`
                        : `₹${appliedCoupon.value} off`}
                    </span>
                  </div>
                )}
                {taxSummary && taxSummary.totalTaxAmount > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>GST</span>
                    <span>{currency.format(taxSummary.totalTaxAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>
                    {!hasItems
                      ? "—"
                      : shippingFee > 0
                        ? currency.format(shippingFee)
                        : "FREE"}
                  </span>
                </div>
                <div className="h-px bg-border-soft" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-foreground">
                    Grand Total
                  </span>
                  <span className="font-serif text-2xl font-light text-foreground">
                    {currency.format(taxSummary ? taxSummary.grandTotal : cartTotal)}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <Button
                    size="lg"
                    className="w-full h-14"
                    onClick={handleCheckout}
                    disabled={!hasItems || loading || isPaying}
                  >
                    {loading || isPaying ? "Redirecting to PhonePe..." : "Proceed to Payment"}
                  </Button>
                </motion.div>

                <p className="text-center text-[10px] text-muted-foreground leading-relaxed">
                  By proceeding, you agree to our terms of service. You&apos;ll
                  be redirected to PhonePe to complete payment securely.
                </p>
              </div>

              {/* Trust Signals */}
              <div className="pt-4 border-t border-border-soft space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-600/60" />
                  <span className="text-xs text-muted-foreground">
                    Secured by PhonePe
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  <span className="text-xs text-muted-foreground">
                    KTMONA Buyer Protection
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  <span className="text-xs text-muted-foreground">
                    10-Day Easy Returns
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
