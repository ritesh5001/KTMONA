"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  getCart,
  removeCartItem,
  updateCartItem,
  type CartResponse,
} from "@/services/cart";
import { getShippingConfig } from "@/services/shipments";
import { toast } from "sonner";
import { startNavigationFeedback } from "@/lib/navigation-feedback";
import { persistCheckoutCartSnapshot } from "@/lib/checkout-snapshot";
import { loginUrlWithReturn } from "@/lib/login-redirect";
import { getSessionRole, hasSession } from "@/lib/session";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function CartPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [canLoad, setCanLoad] = React.useState(false);
  const [cart, setCart] = React.useState<CartResponse["cart"] | null>(null);
  // Admin-controlled shipping charge. Defaults to the flat fee until resolved.
  const [shippingConfig, setShippingConfig] = React.useState<{
    enabled: boolean;
    amount: number;
  }>({ enabled: true, amount: 180 });

  React.useEffect(() => {
    let active = true;
    getShippingConfig()
      .then((config) => {
        if (active) setShippingConfig(config);
      })
      .catch(() => {
        /* Non-fatal: keep the default estimate. */
      });
    return () => {
      active = false;
    };
  }, []);

  const loadCart = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCart();
      setCart(result.cart);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load cart";
      if (/access token required|unauthorized|authentication/i.test(message)) {
        toast.error("Please sign in to view your cart.");
        startNavigationFeedback();
        router.push(loginUrlWithReturn());
        return;
      }
      toast.error(message);
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  React.useEffect(() => {
    // Gate on the shared session check, not on the access cookie alone. An
    // expired access token with a live refresh token is still a session, and
    // demanding the access cookie here bounced signed-in buyers to a login page
    // that immediately considered them signed in again.
    if (!hasSession()) {
      toast.error("Please sign in to view your cart.");
      startNavigationFeedback();
      router.push(loginUrlWithReturn());
      return;
    }

    const role = getSessionRole();
    if (role && role !== "USER") {
      toast.error("Cart is available for customers only.");
      startNavigationFeedback();
      router.push("/marketplace");
      return;
    }

    setCanLoad(true);
  }, [router]);

  React.useEffect(() => {
    if (canLoad) {
      loadCart();
    }
  }, [canLoad, loadCart]);

  const handleQuantity = async (itemId: string, nextQty: number) => {
    if (nextQty <= 0) {
      await handleRemove(itemId);
      return;
    }
    try {
      await updateCartItem(itemId, nextQty);
      await loadCart();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const handleRemove = async (itemId: string) => {
    try {
      await removeCartItem(itemId);
      await loadCart();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Remove failed");
    }
  };

  const items = cart?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + item.priceSnapshot * item.quantity,
    0
  );
  const regularSubtotal = items.reduce(
    (sum, item) =>
      sum +
      (typeof item.variant?.compareAtPrice === "number"
        ? item.variant.compareAtPrice
        : item.priceSnapshot) *
        item.quantity,
    0
  );
  const shipping =
    items.length > 0 && shippingConfig.enabled ? shippingConfig.amount : 0;
  const total = subtotal + shipping;
  const regularTotal = regularSubtotal + shipping;

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
            Your Selection
          </p>
          <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
            Review Your Pieces
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Each piece has been carefully selected. Take a moment to review before proceeding.
          </p>
        </div>

        {/* Content */}
        <div className="grid gap-12 lg:grid-cols-[1.4fr_0.6fr] lg:gap-16">
          {/* Cart Items */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border-soft pb-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Selected Items ({items.length})
              </p>
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <p className="text-sm text-muted-foreground">Loading your selection...</p>
              </div>
            ) : items.length === 0 ? (
              /* Empty State - Inviting */
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="py-20 text-center space-y-6 border border-border-soft bg-mist/50 dark:bg-card/50"
              >
                <div className="space-y-4">
                  <p className="font-serif text-2xl font-light text-foreground">
                    Your collection awaits
                  </p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Discover products from verified sellers across India.
                    Every item comes from a verified KTMONA seller.
                  </p>
                </div>
                <Link
                  href="/marketplace"
                  className="inline-flex h-12 items-center justify-center bg-ink px-8 text-xs font-medium uppercase tracking-[0.15em] text-paper transition-all duration-400 hover:bg-navy dark:bg-brand dark:text-ink dark:hover:bg-brand-muted"
                >
                  Explore Collection
                </Link>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => {
                  const salePrice =
                    typeof item.priceSnapshot === "number" ? item.priceSnapshot : 0;
                  const regularPrice =
                    typeof item.variant?.compareAtPrice === "number"
                      ? item.variant.compareAtPrice
                      : null;

                  return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.5 }}
                    className="group border border-border-soft bg-card p-6 transition-all duration-300 hover:border-brand/30"
                  >
                    <div className="flex gap-6">
                      {/* Product Image - Gallery Frame */}
                      <div className="w-24 h-28 sm:w-32 sm:h-36 shrink-0 bg-mist dark:bg-navy/20 p-2 border border-border-soft">
                        <div className="w-full h-full bg-card flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                            Image
                          </span>
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                            Curated
                          </p>
                          <h3 className="font-serif text-lg font-normal text-foreground">
                            {item.product?.title ?? "Item"}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Variant · {item.variant?.size ?? "Default"} · {item.variant?.sku ?? "—"}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                          {/* Quantity Controls - Handcrafted Feel */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuantity(item.id, item.quantity - 1)}
                              className="w-9 h-9 flex items-center justify-center border border-border-soft text-muted-foreground transition-all duration-300 hover:border-brand/50 hover:text-foreground"
                            >
                              −
                            </button>
                            <span className="w-12 text-center text-sm font-medium text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantity(item.id, item.quantity + 1)}
                              className="w-9 h-9 flex items-center justify-center border border-border-soft text-muted-foreground transition-all duration-300 hover:border-brand/50 hover:text-foreground"
                            >
                              +
                            </button>
                          </div>

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="font-serif text-lg font-light text-foreground">
                          {currency.format(salePrice)}
                        </p>
                        {typeof regularPrice === "number" && regularPrice !== salePrice ? (
                          <p className="text-xs text-muted-foreground line-through">
                            {currency.format(regularPrice)}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground mt-1">
                          Line: {currency.format(salePrice * (item.quantity ?? 1))}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary - Tailor's Receipt */}
          <div className="lg:sticky lg:top-24">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="border border-border-soft bg-card p-8 space-y-8"
            >
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  Order Summary
                </p>
                <div className="h-px bg-border-soft" />
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <div className="text-right">
                    <span>{currency.format(subtotal)}</span>
                    {regularSubtotal !== subtotal ? (
                      <p className="text-xs text-muted-foreground line-through">
                        {currency.format(regularSubtotal)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>
                    {items.length === 0
                      ? "—"
                      : shipping > 0
                        ? currency.format(shipping)
                        : "FREE"}
                  </span>
                </div>
                <div className="h-px bg-border-soft" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-foreground">
                    Total
                  </span>
                  <div className="text-right">
                    <span className="font-serif text-2xl font-light text-foreground">
                      {currency.format(total)}
                    </span>
                    {regularTotal !== total ? (
                      <p className="text-xs text-muted-foreground line-through">
                        {currency.format(regularTotal)}
                      </p>
                    ) : null}
                  </div>
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
                    onClick={() => {
                      persistCheckoutCartSnapshot(
                        items.map((item) => ({
                          variantId: item.variantId,
                          quantity: item.quantity,
                          priceSnapshot: item.priceSnapshot,
                        }))
                      );
                      startNavigationFeedback();
                      router.push("/checkout");
                    }}
                    disabled={items.length === 0}
                  >
                    Proceed to Checkout
                  </Button>
                </motion.div>

                <Link
                  href="/marketplace"
                  className="block text-center text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
                >
                  Continue Exploring
                </Link>
              </div>

              {/* Trust Signal */}
              <div className="pt-4 border-t border-border-soft">
                <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-brand" />
                    Secure Checkout
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-brand" />
                    Easy Returns
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
