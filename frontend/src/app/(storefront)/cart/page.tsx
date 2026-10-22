"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Bookmark, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  changeCartItemVariant,
  getCart,
  getCheckoutQuote,
  removeCartItem,
  setCartItemSavedForLater,
  updateCartItem,
  type CartItemDetails,
  type CartResponse,
  type CheckoutQuote,
} from "@/services/cart";
import { getShippingConfig } from "@/services/shipments";
import { FreeDeliveryProgress, PriceBreakup, formatInr } from "@/components/checkout/PriceBreakup";
import { startNavigationFeedback } from "@/lib/navigation-feedback";
import { persistCheckoutCartSnapshot } from "@/lib/checkout-snapshot";
import { loginUrlWithReturn } from "@/lib/login-redirect";
import { getSessionRole, hasSession } from "@/lib/session";
import {
  readGuestCart,
  removeGuestCartLine,
  setGuestCartQuantity,
  subscribeGuestCart,
  type GuestCartLine,
} from "@/lib/guest-cart";

const PLACEHOLDER = "/images/product-placeholder.svg";

export default function CartPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"loading" | "guest" | "account">("loading");

  React.useEffect(() => {
    if (!hasSession()) {
      setMode("guest");
      return;
    }
    const role = getSessionRole();
    if (role && role !== "USER") {
      toast.error("Cart is available for customers only.");
      startNavigationFeedback();
      router.push("/marketplace");
      return;
    }
    setMode("account");
  }, [router]);

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">Shopping Cart</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Your Cart</h1>
        </div>
        {mode === "account" ? <AccountCart /> : mode === "guest" ? <GuestCart /> : <CartSkeleton />}
      </div>
    </div>
  );
}

function CartSkeleton() {
  return <div className="h-64 animate-pulse rounded-2xl border border-border-soft bg-mist/40" aria-busy="true" />;
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-soft bg-card px-6 py-16 text-center">
      <ShoppingCart className="h-10 w-10 text-muted-foreground/50" strokeWidth={1.4} />
      <p className="text-lg font-medium text-foreground">Your cart is empty</p>
      <p className="max-w-sm text-sm text-muted-foreground">Discover products from verified sellers across India.</p>
      <Button asChild>
        <Link href="/marketplace">Start shopping</Link>
      </Button>
    </div>
  );
}

/* ── Signed-in cart: server cart + server price quote ───────────────────── */

function AccountCart() {
  const router = useRouter();
  const [cart, setCart] = React.useState<CartResponse["cart"] | null>(null);
  const [quote, setQuote] = React.useState<CheckoutQuote | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [cartResult, quoteResult] = await Promise.all([
        getCart(),
        getCheckoutQuote().catch(() => null),
      ]);
      setCart(cartResult.cart);
      setQuote(quoteResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load cart";
      if (/access token required|unauthorized|authentication/i.test(message)) {
        toast.error("Please sign in to view your cart.");
        startNavigationFeedback();
        router.push(loginUrlWithReturn());
        return;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const run = async (itemId: string, action: () => Promise<unknown>, success?: string) => {
    setBusyId(itemId);
    try {
      await action();
      if (success) toast.success(success);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <CartSkeleton />;

  const items = cart?.items ?? [];
  const saved = cart?.savedItems ?? [];
  if (items.length === 0 && saved.length === 0) return <EmptyCart />;

  const blocked = quote ? !quote.canPlaceOrder : items.length === 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-border-soft bg-card p-6 text-sm text-muted-foreground">
            No items in your cart. Move something from “Saved for later”, or{" "}
            <Link href="/marketplace" className="font-medium text-brand-strong hover:underline">keep shopping</Link>.
          </div>
        ) : (
          <section aria-label="Cart items" className="space-y-3">
            {quote?.issues.length ? (
              <div role="alert" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Some items can’t be ordered right now</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {quote.issues.map((i) => <li key={i.itemId}>{i.message}</li>)}
                  </ul>
                  <p>Reduce the quantity, remove them or save them for later to continue.</p>
                </div>
              </div>
            ) : null}
            {items.map((item) => (
              <CartLine
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onQuantity={(qty) =>
                  qty <= 0
                    ? run(item.id, () => removeCartItem(item.id), "Removed from cart")
                    : run(item.id, () => updateCartItem(item.id, qty))
                }
                onVariant={(variantId) => run(item.id, () => changeCartItemVariant(item.id, variantId), "Updated")}
                onRemove={() => run(item.id, () => removeCartItem(item.id), "Removed from cart")}
                onSave={() => run(item.id, () => setCartItemSavedForLater(item.id, true), "Saved for later")}
              />
            ))}
          </section>
        )}

        {saved.length > 0 ? (
          <section aria-label="Saved for later" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Saved for later ({saved.length})
            </h2>
            {saved.map((item) => (
              <CartLine
                key={item.id}
                item={item}
                saved
                busy={busyId === item.id}
                onRemove={() => run(item.id, () => removeCartItem(item.id), "Removed")}
                onSave={() => run(item.id, () => setCartItemSavedForLater(item.id, false), "Moved to cart")}
              />
            ))}
          </section>
        ) : null}
      </div>

      {items.length > 0 ? (
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {quote ? <FreeDeliveryProgress freeDelivery={quote.freeDelivery} /> : null}
          <div className="space-y-5 rounded-2xl border border-border-soft bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Price details</h2>
            {quote ? <PriceBreakup quote={quote} /> : <p className="text-sm text-muted-foreground">Calculating…</p>}
            <p className="text-xs text-muted-foreground">Apply coupons at checkout.</p>
            <Button
              size="lg"
              className="h-12 w-full"
              disabled={blocked}
              onClick={() => {
                persistCheckoutCartSnapshot(
                  items.map((item) => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    priceSnapshot: item.variant?.price ?? item.priceSnapshot,
                  }))
                );
                startNavigationFeedback();
                router.push("/checkout");
              }}
            >
              Place order
            </Button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function CartLine({
  item,
  saved,
  busy,
  onQuantity,
  onVariant,
  onRemove,
  onSave,
}: {
  item: CartItemDetails;
  saved?: boolean;
  busy: boolean;
  onQuantity?: (qty: number) => void;
  onVariant?: (variantId: string) => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  const a = item.availability;
  const price = item.variant?.price ?? item.priceSnapshot;
  const mrp = item.variant?.compareAtPrice && item.variant.compareAtPrice > price ? item.variant.compareAtPrice : null;
  const image = item.variant?.images?.[0] ?? item.product?.images?.[0] ?? PLACEHOLDER;
  const options = item.options ?? [];
  const unavailable = a?.status === "UNAVAILABLE" || a?.status === "OUT_OF_STOCK";
  const optionLabel = (o: { size: string; color: string | null }) =>
    [o.color, o.size && o.size !== "Default" ? o.size : null].filter(Boolean).join(" / ") || "Default";

  return (
    <article className={`flex gap-4 rounded-2xl border bg-card p-4 ${unavailable ? "border-amber-300" : "border-border-soft"} ${busy ? "opacity-60" : ""}`} aria-busy={busy}>
      <Link href={`/product/${item.productId}`} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-mist sm:h-32 sm:w-28">
        <Image src={image} alt={item.product?.title ?? "Product"} fill sizes="112px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Link href={`/product/${item.productId}`} className="line-clamp-2 text-sm font-medium text-foreground hover:underline">
          {item.product?.title ?? "Item"}
        </Link>

        {!saved && options.length > 1 && onVariant ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Size / colour
            <select
              className="h-8 rounded-lg border border-border-soft bg-background px-2 text-xs text-foreground"
              value={item.variantId}
              disabled={busy}
              onChange={(e) => onVariant(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id} disabled={o.stock <= 0 && o.id !== item.variantId}>
                  {optionLabel(o)}
                  {o.stock <= 0 ? " (sold out)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : item.variant ? (
          <p className="text-xs text-muted-foreground">{optionLabel({ size: item.variant.size, color: item.variant.color ?? null })}</p>
        ) : null}

        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-semibold text-foreground">{formatInr(price)}</span>
          {mrp ? (
            <>
              <span className="text-xs text-muted-foreground line-through">{formatInr(mrp)}</span>
              <span className="text-xs font-medium text-emerald-700">{Math.round(((mrp - price) / mrp) * 100)}% off</span>
            </>
          ) : null}
        </div>

        <Badges availability={a} />

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          {!saved && onQuantity ? (
            <div className="flex items-center rounded-lg border border-border-soft" role="group" aria-label="Quantity">
              <button type="button" className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={busy} onClick={() => onQuantity(item.quantity - 1)} aria-label="Decrease quantity">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-medium" aria-live="polite">{item.quantity}</span>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={busy || (a ? item.quantity >= a.maxQuantity : false)}
                onClick={() => onQuantity(item.quantity + 1)}
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <button type="button" onClick={onSave} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-brand-strong">
            {saved ? <ShoppingCart className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            {saved ? "Move to cart" : "Save for later"}
          </button>
          <button type="button" onClick={onRemove} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}

function Badges({ availability: a }: { availability?: CartItemDetails["availability"] }) {
  if (!a) return null;
  const chips: React.ReactNode[] = [];
  if (a.status === "UNAVAILABLE") chips.push(<Chip key="u" tone="bad">Currently unavailable</Chip>);
  else if (a.status === "OUT_OF_STOCK") chips.push(<Chip key="o" tone="bad">Out of stock</Chip>);
  else if (a.quantityTooHigh) chips.push(<Chip key="q" tone="bad">Only {a.stock} available — reduce quantity</Chip>);
  else if (a.status === "LOW_STOCK") chips.push(<Chip key="l" tone="warn">Only {a.stock} left</Chip>);
  if (a.priceChange > 0) {
    chips.push(
      <Chip key="p" tone="warn">
        <ArrowUp className="h-3 w-3" /> Price increased by {formatInr(a.priceChange)}
      </Chip>
    );
  } else if (a.priceChange < 0) {
    chips.push(
      <Chip key="p" tone="good">
        <ArrowDown className="h-3 w-3" /> Price dropped by {formatInr(-a.priceChange)}
      </Chip>
    );
  }
  return chips.length ? <div className="flex flex-wrap gap-1.5">{chips}</div> : null;
}

function Chip({ tone, children }: { tone: "bad" | "warn" | "good"; children: React.ReactNode }) {
  const cls =
    tone === "bad"
      ? "bg-red-50 text-red-700"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800"
        : "bg-emerald-50 text-emerald-800";
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

/* ── Guest cart: on this device until they verify at checkout ───────────── */

function GuestCart() {
  const router = useRouter();
  const [lines, setLines] = React.useState<GuestCartLine[]>([]);
  const [shipping, setShipping] = React.useState<{ enabled: boolean; amount: number; freeAbove?: number }>({ enabled: false, amount: 0 });

  React.useEffect(() => {
    const sync = () => setLines(readGuestCart());
    sync();
    getShippingConfig().then(setShipping).catch(() => undefined);
    return subscribeGuestCart(sync);
  }, []);

  if (lines.length === 0) return <EmptyCart />;

  const itemsTotal = lines.reduce((sum, l) => sum + (l.price ?? 0) * l.quantity, 0);
  const mrpTotal = lines.reduce((sum, l) => sum + Math.max(l.mrp ?? 0, l.price ?? 0) * l.quantity, 0);
  const freeAbove = shipping.freeAbove ?? 0;
  const delivery = shipping.enabled && !(freeAbove > 0 && itemsTotal >= freeAbove) ? shipping.amount : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section aria-label="Cart items" className="space-y-3">
        {lines.map((l) => (
          <article key={l.variantId} className="flex gap-4 rounded-2xl border border-border-soft bg-card p-4">
            <Link href={`/product/${l.productId}`} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-mist">
              <Image src={l.image ?? PLACEHOLDER} alt={l.title} fill sizes="96px" className="object-cover" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Link href={`/product/${l.productId}`} className="line-clamp-2 text-sm font-medium hover:underline">{l.title}</Link>
              <p className="text-xs text-muted-foreground">{[l.color, l.size && l.size !== "Default" ? l.size : null].filter(Boolean).join(" / ")}</p>
              {l.price != null ? <p className="text-base font-semibold">{formatInr(l.price)}</p> : null}
              <div className="mt-auto flex items-center gap-4">
                <div className="flex items-center rounded-lg border border-border-soft" role="group" aria-label="Quantity">
                  <button type="button" className="flex h-8 w-8 items-center justify-center" onClick={() => setGuestCartQuantity(l.variantId, l.quantity - 1)} aria-label="Decrease quantity"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-8 text-center text-sm font-medium">{l.quantity}</span>
                  <button type="button" className="flex h-8 w-8 items-center justify-center" onClick={() => setGuestCartQuantity(l.variantId, l.quantity + 1)} aria-label="Increase quantity"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <button type="button" onClick={() => removeGuestCartLine(l.variantId)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="space-y-4 rounded-2xl border border-border-soft bg-card p-5 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Price details (estimate)</h2>
          <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>{formatInr(mrpTotal)}</span></div>
          {mrpTotal > itemsTotal ? <div className="flex justify-between"><span className="text-muted-foreground">Discount on MRP</span><span className="text-emerald-700">−{formatInr(mrpTotal - itemsTotal)}</span></div> : null}
          <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{delivery > 0 ? formatInr(delivery) : "FREE"}</span></div>
          {shipping.enabled && freeAbove > 0 && itemsTotal < freeAbove ? (
            <p className="rounded-lg bg-mist/60 px-3 py-2 text-xs">Add <strong>{formatInr(freeAbove - itemsTotal)}</strong> more for FREE delivery</p>
          ) : null}
          <p className="text-xs text-muted-foreground">GST and the final total are shown at checkout before you pay.</p>
          <Button size="lg" className="h-12 w-full" onClick={() => { startNavigationFeedback(); router.push("/checkout"); }}>
            Checkout as guest
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Have an account?{" "}
            <Link href="/login?returnTo=%2Fcheckout" className="font-medium text-brand-strong hover:underline">Sign in</Link>
          </p>
        </div>
      </aside>
    </div>
  );
}
