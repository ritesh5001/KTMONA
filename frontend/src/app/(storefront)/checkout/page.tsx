"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Lock, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  checkoutWithPayment,
  getCheckoutQuote,
  mergeCart,
  type CheckoutQuote,
  type CouponPreview,
} from "@/services/cart";
import { initiatePayment, verifyRazorpayPayment } from "@/services/payments";
import { loadRazorpayCheckout, openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { ApiTimeoutError } from "@/services/api";
import { flushPendingCartWrite } from "@/lib/pending-cart";
import { createAddress, getAddresses, type Address } from "@/services/addresses";
import { getMyProfile } from "@/services/account";
import { persistAuthCookies, requestGuestOtp, verifyAuthOtp } from "@/services/auth";
import CouponSection from "@/components/checkout/CouponSection";
import { FreeDeliveryProgress, PriceBreakup, formatInr } from "@/components/checkout/PriceBreakup";
import { getSessionRole, hasSession } from "@/lib/session";
import { startNavigationFeedback } from "@/lib/navigation-feedback";
import { clearCheckoutCartSnapshot } from "@/lib/checkout-snapshot";
import { clearGuestCart, readGuestCart } from "@/lib/guest-cart";
import { readReferralCode } from "@/lib/referral-code";

const PLACEHOLDER = "/images/product-placeholder.svg";

/** Quick picks for the delivery-instructions box. */
const INSTRUCTION_CHIPS = [
  "Call me before delivery",
  "Leave with the security guard",
  "Don't ring the bell",
  "Deliver after 6 PM",
];

type Contact = { name: string; email: string; phone: string };

export default function CheckoutPage() {
  const router = useRouter();
  const [state, setState] = React.useState<"checking" | "guest" | "ready">("checking");
  const [guestContact, setGuestContact] = React.useState<Contact | null>(null);

  React.useEffect(() => {
    // Checked on each mount (not in the proxy): a cached redirect used to replay
    // against a session that had since become valid.
    if (hasSession()) {
      const role = getSessionRole();
      if (role && role !== "USER") {
        toast.error("Checkout is available for customers only.");
        router.replace("/marketplace");
        return;
      }
      setState("ready");
    } else {
      setState("guest");
    }
  }, [router]);

  if (state === "checking") {
    return <div className="min-h-[calc(100vh-160px)] bg-background" aria-busy="true" />;
  }

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            <Lock className="h-3 w-3" /> Secure checkout
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Checkout</h1>
        </div>
        {state === "guest" ? (
          <GuestGate
            onVerified={(contact) => {
              setGuestContact(contact);
              setState("ready");
            }}
          />
        ) : (
          <CheckoutForm guestContact={guestContact} />
        )}
      </div>
    </div>
  );
}

/* ── Guest checkout: verify email with a one-time code ──────────────────── */

function GuestGate({ onVerified }: { onVerified: (contact: Contact) => void }) {
  const [contact, setContact] = React.useState<Contact>({ name: "", email: "", phone: "" });
  const [step, setStep] = React.useState<"details" | "code">("details");
  const [verifyWith, setVerifyWith] = React.useState<{ email?: string; phone?: string } | null>(null);
  const [existingAccount, setExistingAccount] = React.useState(false);
  const [otp, setOtp] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const guestLines = React.useMemo(() => readGuestCart(), []);

  if (guestLines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-soft bg-card px-6 py-16 text-center">
        <p className="text-lg font-medium">Your cart is empty</p>
        <p className="text-sm text-muted-foreground">Add something to your cart, or sign in to see your saved cart.</p>
        <div className="flex gap-3">
          <Button asChild><Link href="/marketplace">Start shopping</Link></Button>
          <Button asChild variant="outline"><Link href="/login?returnTo=%2Fcheckout">Sign in</Link></Button>
        </div>
      </div>
    );
  }

  const sendCode = async () => {
    const name = contact.name.trim();
    const email = contact.email.trim();
    const phone = contact.phone.replace(/\D/g, "");
    if (name.length < 2) return toast.error("Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Enter a valid email address.");
    if (phone && !/^\d{10,15}$/.test(phone)) return toast.error("Mobile number must be 10 to 15 digits.");
    setBusy(true);
    try {
      const referralCode = readReferralCode();
      const res = await requestGuestOtp({ fullName: name, email, ...(phone ? { phone } : {}), ...(referralCode ? { referralCode } : {}) });
      setVerifyWith(res.verifyWith ?? { email });
      setExistingAccount(res.existingAccount);
      setStep("code");
      toast.success(res.message ?? "Code sent to your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{4,8}$/.test(otp.trim())) return toast.error("Enter the code from your email.");
    setBusy(true);
    try {
      const result = await verifyAuthOtp({ ...(verifyWith ?? { email: contact.email.trim() }), otp: otp.trim() });
      if (!result.accessToken || !result.refreshToken || !result.user) {
        throw new Error(result.message ?? "Verification failed. Please try again.");
      }
      if (result.user.role?.toUpperCase() !== "USER") {
        throw new Error("Please use a customer account to shop.");
      }
      persistAuthCookies(result.accessToken, result.refreshToken, result.user);
      // Move the on-device cart into the account.
      const lines = readGuestCart();
      if (lines.length) {
        const merged = await mergeCart(lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })));
        if (merged.skipped.length) toast.warning(`${merged.skipped.length} item(s) are no longer available and were left out.`);
      }
      clearGuestCart();
      toast.success("Verified. Let’s finish your order.");
      onVerified({ name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.replace(/\D/g, "") });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-5 rounded-2xl border border-border-soft bg-card p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Checkout as guest</h2>
          <p className="text-sm text-muted-foreground">
            No password needed. We’ll email you a one-time code so you can track this order later.
          </p>
        </div>
        {step === "details" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="g-name" required>Full name</Label>
              <Input id="g-name" autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="g-email" required>Email</Label>
                <Input id="g-email" type="email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-phone">Mobile number</Label>
                <Input id="g-phone" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </div>
            </div>
            <Button type="submit" size="lg" className="h-12 w-full" disabled={busy}>
              {busy ? "Sending code…" : "Send verification code"}
            </Button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <p className="text-sm">
              Enter the code sent to <strong>{verifyWith?.email ?? verifyWith?.phone ?? contact.email}</strong>.
              {existingAccount ? " This email already has a KTMONA account, so the order will be added to it." : ""}
            </p>
            <Input
              aria-label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.4em]"
            />
            <Button type="submit" size="lg" className="h-12 w-full" disabled={busy}>
              {busy ? "Verifying…" : "Verify and continue"}
            </Button>
            <div className="flex justify-between text-xs">
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setStep("details")}>Change details</button>
              <button type="button" className="font-medium text-brand-strong hover:underline" disabled={busy} onClick={() => void sendCode()}>Resend code</button>
            </div>
          </form>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Have an account? <Link href="/login?returnTo=%2Fcheckout" className="font-medium text-brand-strong hover:underline">Sign in</Link>
        </p>
      </section>
      <aside className="space-y-3 rounded-2xl border border-border-soft bg-card p-5 lg:self-start">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">In your cart</h2>
        {guestLines.map((l) => (
          <div key={l.variantId} className="flex items-center gap-3 text-sm">
            <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-mist">
              <Image src={l.image ?? PLACEHOLDER} alt="" fill sizes="48px" className="bg-white object-contain" />
            </div>
            <span className="line-clamp-2 flex-1">{l.title}</span>
            <span className="text-muted-foreground">×{l.quantity}</span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">You’ll see the full price, GST and delivery charges before paying.</p>
      </aside>
    </div>
  );
}

/* ── Checkout form ──────────────────────────────────────────────────────── */

type AddressForm = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
};

const EMPTY_ADDRESS: AddressForm = { addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" };

function CheckoutForm({ guestContact }: { guestContact: Contact | null }) {
  const router = useRouter();
  const [quote, setQuote] = React.useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = React.useState(true);
  const [contact, setContact] = React.useState<Contact>(guestContact ?? { name: "", email: "", phone: "" });
  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | "new">("new");
  const [newAddress, setNewAddress] = React.useState<AddressForm>(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"ONLINE" | "COD">("ONLINE");
  const [appliedCoupon, setAppliedCoupon] = React.useState<CouponPreview | null>(null);
  const [useWallet, setUseWallet] = React.useState(false);
  const [placing, setPlacing] = React.useState(false);
  // One key per visit to this page: a retry or double click returns the same order.
  const checkoutKey = React.useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  React.useEffect(() => {
    loadRazorpayCheckout().catch(() => undefined);
    getMyProfile()
      .then(({ profile }) =>
        setContact((c) => ({
          name: c.name || profile.fullName || "",
          email: c.email || profile.email || "",
          phone: c.phone || profile.phone || "",
        }))
      )
      .catch(() => undefined);
    getAddresses()
      .then(({ addresses: list }) => {
        setAddresses(list);
        const preferred = list.find((a) => a.isDefault) ?? list[0];
        if (preferred) setSelectedAddressId(preferred.id);
      })
      .catch(() => undefined);
  }, []);

  const couponCode = appliedCoupon?.code;
  const refreshQuote = React.useCallback(async () => {
    setQuoteLoading(true);
    try {
      // Buy Now navigates here while its add-to-cart is still in flight.
      await flushPendingCartWrite().catch(() => undefined);
      const q = await getCheckoutQuote({ ...(couponCode ? { couponCode } : {}), paymentMethod, useWallet });
      setQuote(q);
      if (couponCode && q.couponError) {
        toast.error(q.couponError);
        setAppliedCoupon(null);
      }
      if (paymentMethod === "COD" && !q.cod.available) setPaymentMethod("ONLINE");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load your order summary");
    } finally {
      setQuoteLoading(false);
    }
  }, [couponCode, paymentMethod, useWallet]);

  React.useEffect(() => {
    void refreshQuote();
  }, [refreshQuote]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const address: AddressForm = selectedAddress
    ? {
        addressLine1: selectedAddress.addressLine1,
        addressLine2: selectedAddress.addressLine2 ?? "",
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
      }
    : newAddress;

  const placeOrder = async () => {
    if (placing || !quote) return;
    const missing = (
      [
        ["Full name", contact.name],
        ["Phone", contact.phone],
        ["Address", address.addressLine1],
        ["City", address.city],
        ["Pincode", address.pincode],
      ] as const
    )
      .filter(([, v]) => !v?.trim())
      .map(([f]) => f);
    if (missing.length) return toast.error(`Please fill in: ${missing.join(", ")}`);
    if (!/^\d{6}$/.test(address.pincode.trim())) return toast.error("Please enter a valid 6-digit pincode");
    if (!/^\+?\d[\d\s-]{8,}$/.test(contact.phone.trim())) return toast.error("Please enter a valid phone number");

    setPlacing(true);
    try {
      await flushPendingCartWrite();

      if (selectedAddressId === "new" && saveAddress && address.state.trim().length >= 2) {
        // Best effort: the order does not depend on it.
        void createAddress({
          addressLine1: address.addressLine1.trim(),
          ...(address.addressLine2.trim() ? { addressLine2: address.addressLine2.trim() } : {}),
          city: address.city.trim(),
          state: address.state.trim(),
          pincode: address.pincode.trim(),
          isDefault: addresses.length === 0,
        }).catch(() => undefined);
      }

      const result = await checkoutWithPayment({
        shippingName: contact.name.trim(),
        shippingPhone: contact.phone.trim(),
        ...(contact.email.trim() ? { shippingEmail: contact.email.trim() } : {}),
        shippingAddressLine1: address.addressLine1.trim(),
        ...(address.addressLine2.trim() ? { shippingAddressLine2: address.addressLine2.trim() } : {}),
        shippingCity: address.city.trim(),
        shippingPincode: address.pincode.trim(),
        ...(notes.trim() ? { shippingNotes: notes.trim() } : {}),
        ...(couponCode ? { couponCode } : {}),
        paymentMethod,
        checkoutKey: checkoutKey.current,
        ...(useWallet ? { useWallet: true } : {}),
      });

      const orderId = result.order?.id;
      if (!orderId) throw new Error("Order ID missing. Please try again.");
      clearCheckoutCartSnapshot();

      // COD, or a repeat submit of an order that is already paid: done.
      if (result.paymentMethod === "COD" || (result.duplicate && result.order && !result.payment && !result.paymentInitError)) {
        startNavigationFeedback();
        router.push(`/order-confirmation/${orderId}`);
        return;
      }

      if (!result.payment && result.paymentInitError) throw Object.assign(new Error(result.paymentInitError), { orderId });
      const payment = result.payment ?? (await initiatePayment(orderId)).data;

      const paid = await openRazorpayCheckout(payment);
      if (paid.status === "dismissed") {
        // The order stays payable; the confirmation page offers Retry Payment.
        startNavigationFeedback();
        router.push(`/order-confirmation/${orderId}${paid.lastError ? `?error=${encodeURIComponent(paid.lastError)}` : ""}`);
        return;
      }
      await verifyRazorpayPayment({
        orderId,
        razorpayPaymentId: paid.razorpayPaymentId,
        razorpaySignature: paid.razorpaySignature,
      }).catch(() => null);
      startNavigationFeedback();
      router.push(`/order-confirmation/${orderId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      const orderId = (error as { orderId?: string })?.orderId;
      if (orderId) {
        toast.error(`${message}. You can retry the payment.`, { duration: 8000 });
        router.push(`/order-confirmation/${orderId}`);
        return;
      }
      if (error instanceof ApiTimeoutError) {
        // The order may have been placed while we stopped listening. Placing again
        // with the same checkout key is safe: it returns that order.
        toast.error("This is taking longer than usual. Tap Place order again — you won't be charged twice.", { duration: 10000 });
      } else if (/cart is empty/i.test(message)) {
        toast.error("Your cart is empty. Check your orders for recent purchases.");
        router.push("/user/orders");
        return;
      } else {
        toast.error(message, { duration: 8000 });
        void refreshQuote();
      }
      setPlacing(false);
    }
  };

  const lines = quote?.lines ?? [];
  const canPlace = Boolean(quote?.canPlaceOrder) && !quoteLoading && !placing;

  if (!quoteLoading && quote && lines.length === 0 && quote.issues.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-soft bg-card px-6 py-16 text-center">
        <p className="text-lg font-medium">Your cart is empty</p>
        <Button asChild><Link href="/marketplace">Start shopping</Link></Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {/* 1. Contact */}
        <Step n={1} title="Contact details">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="c-name" label="Full name" required value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} autoComplete="name" />
            <Field id="c-phone" label="Phone" required value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} autoComplete="tel" inputMode="tel" />
            <Field id="c-email" label="Email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} autoComplete="email" type="email" />
          </div>
        </Step>

        {/* 2. Address */}
        <Step n={2} title="Delivery address">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery address">
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={selectedAddressId === a.id}
                onClick={() => setSelectedAddressId(a.id)}
                className={`rounded-xl border p-4 text-left text-sm transition-colors ${selectedAddressId === a.id ? "border-brand bg-brand/5" : "border-border-soft hover:border-brand/40"}`}
              >
                <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {a.label}
                  {a.isDefault ? <span className="text-emerald-700">Default</span> : null}
                </span>
                <span className="block text-foreground">{a.addressLine1}</span>
                {a.addressLine2 ? <span className="block text-muted-foreground">{a.addressLine2}</span> : null}
                <span className="block text-muted-foreground">{a.city}, {a.state} – {a.pincode}</span>
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={selectedAddressId === "new"}
              onClick={() => setSelectedAddressId("new")}
              className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-medium ${selectedAddressId === "new" ? "border-brand bg-brand/5" : "border-dashed border-border-soft hover:border-brand/40"}`}
            >
              <Plus className="h-4 w-4" /> Add a new address
            </button>
          </div>
          {selectedAddressId === "new" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id="a1" label="House no., building, street" required value={newAddress.addressLine1} onChange={(v) => setNewAddress({ ...newAddress, addressLine1: v })} autoComplete="address-line1" />
              <Field id="a2" label="Area, landmark" value={newAddress.addressLine2} onChange={(v) => setNewAddress({ ...newAddress, addressLine2: v })} autoComplete="address-line2" />
              <Field id="pin" label="Pincode" required value={newAddress.pincode} onChange={(v) => setNewAddress({ ...newAddress, pincode: v.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" autoComplete="postal-code" />
              <Field id="city" label="City" required value={newAddress.city} onChange={(v) => setNewAddress({ ...newAddress, city: v })} autoComplete="address-level2" />
              <Field id="state" label="State" value={newAddress.state} onChange={(v) => setNewAddress({ ...newAddress, state: v })} autoComplete="address-level1" />
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                Save this address for next time
              </label>
            </div>
          ) : null}
        </Step>

        {/* 3. Delivery instructions */}
        <Step n={3} title="Delivery instructions (optional)">
          <div className="mb-3 flex flex-wrap gap-2">
            {INSTRUCTION_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setNotes((n) => (n.includes(chip) ? n : [n.trim(), chip].filter(Boolean).join(". ")))}
                className="rounded-full border border-border-soft px-3 py-1.5 text-xs hover:bg-mist"
              >
                + {chip}
              </button>
            ))}
          </div>
          <Textarea
            aria-label="Delivery instructions"
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Landmark, preferred time, gate code…"
            className="min-h-20"
          />
        </Step>

        {/* 4. Payment */}
        <Step n={4} title="Payment method">
          <div className="space-y-2" role="radiogroup" aria-label="Payment method">
            <PayOption
              checked={paymentMethod === "ONLINE"}
              onSelect={() => setPaymentMethod("ONLINE")}
              title="Pay online"
              detail="UPI, cards, net banking and wallets via Razorpay. Your saved cards and UPI IDs appear in the payment window."
            />
            <PayOption
              checked={paymentMethod === "COD"}
              onSelect={() => setPaymentMethod("COD")}
              disabled={!quote?.cod.available}
              title="Cash on Delivery"
              detail={quote?.cod.available ? "Pay in cash or UPI to the delivery partner." : quote?.cod.reason ?? "Not available for this order."}
            />
          </div>
        </Step>
      </div>

      {/* Order summary */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="space-y-4 rounded-2xl border border-border-soft bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Order summary {quote ? `(${quote.itemCount} item${quote.itemCount === 1 ? "" : "s"})` : ""}
          </h2>
          <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {lines.map((l) => (
              <li key={l.itemId} className="flex gap-3 text-sm">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-mist">
                  <Image src={l.image ?? PLACEHOLDER} alt="" fill sizes="56px" className="bg-white object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[l.color, l.size && l.size !== "Default" ? l.size : null].filter(Boolean).join(" / ")} · Qty {l.quantity}
                  </p>
                </div>
                <p className="font-medium">{formatInr(l.lineTotal)}</p>
              </li>
            ))}
          </ul>
          {quote?.issues.length ? (
            <div role="alert" className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                {quote.issues.map((i) => <p key={i.itemId}>{i.message}</p>)}
                <Link href="/cart" className="font-semibold underline">Fix in cart</Link>
              </div>
            </div>
          ) : null}
          <Link href="/cart" className="block text-xs font-medium text-brand-strong hover:underline">Edit cart</Link>
        </section>

        <CouponSection
          cartTotal={quote?.itemsTotal ?? 0}
          appliedCoupon={appliedCoupon}
          onApply={setAppliedCoupon}
          onRemove={() => setAppliedCoupon(null)}
          disabled={placing}
        />

        {quote ? <FreeDeliveryProgress freeDelivery={quote.freeDelivery} /> : null}

        {quote?.wallet && quote.wallet.available > 0 ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border-soft bg-card p-4 text-sm">
            <input type="checkbox" className="mt-1" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} disabled={placing} />
            <span>
              <span className="block font-medium">Use cashback · {formatInr(quote.wallet.usable)}</span>
              <span className="block text-xs text-muted-foreground">
                Balance {formatInr(quote.wallet.available)}. Cashback can pay for part of each order.{" "}
                <Link href="/user/wallet" className="underline">Wallet</Link>
              </span>
            </span>
          </label>
        ) : null}

        <section className="space-y-4 rounded-2xl border border-border-soft bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Price details</h2>
          {quote ? <PriceBreakup quote={quote} /> : <p className="text-sm text-muted-foreground">Calculating…</p>}
          <Button size="lg" className="h-12 w-full" disabled={!canPlace} onClick={() => void placeOrder()} aria-busy={placing}>
            {placing
              ? paymentMethod === "COD" ? "Placing your order…" : "Opening secure payment…"
              : paymentMethod === "COD"
                ? `Place order · ${quote ? formatInr(quote.total) : ""}`
                : `Pay ${quote ? formatInr(quote.total) : ""}`}
          </Button>
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-700" />
            <span>
              This is the final amount, including GST and delivery. By placing the order you agree to our{" "}
              <Link href="/terms" className="underline">terms</Link> and{" "}
              <Link href="/return-policy" className="underline">7-day return policy</Link>.
            </span>
          </p>
        </section>
      </aside>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-soft bg-card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-base font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs text-paper">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  required,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} required={required}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function PayOption({
  checked,
  onSelect,
  disabled,
  title,
  detail,
}: {
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-4 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${checked ? "border-brand bg-brand/5" : "border-border-soft"}`}
    >
      <input type="radio" name="payment" className="mt-1" checked={checked} disabled={disabled} onChange={onSelect} />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}
