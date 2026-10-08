"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { CommerceFlowButton } from "@/components/ui/commerce-flow-button";
import { addCartItem } from "@/services/cart";
import {
    getProductById,
    type CatalogProductDetail,
    type CatalogVariant,
} from "@/services/catalog";
import {
    removeCheckoutSnapshotItem,
    upsertCheckoutSnapshotItem,
} from "@/lib/checkout-snapshot";
import { normalizeHex } from "@/lib/color-swatches";
import { loginUrlWithReturn } from "@/lib/login-redirect";
import { hasSession } from "@/lib/session";
import { startNavigationFeedback } from "@/lib/navigation-feedback";
import { buildSizeOptions } from "@/lib/variant-attributes";

export type QuickBuyIntent = "cart" | "buy";

const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
});

const inStock = (variant: CatalogVariant) => (variant.inventory?.stock ?? 0) > 0;



/**
 * Add to cart without leaving the grid.
 *
 * The card's "Add to Cart" used to be a link to the product page, so buying
 * anything meant a full navigation first. This resolves the product's variants
 * in place and asks only for what cannot be guessed — the size.
 */
export function QuickBuyDialog({
    productId,
    intent,
    open,
    onClose,
}: {
    productId: string | null;
    intent: QuickBuyIntent;
    open: boolean;
    onClose: () => void;
}) {
    const router = useRouter();
    const [product, setProduct] = React.useState<CatalogProductDetail | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [selectedColor, setSelectedColor] = React.useState<string | null>(null);
    const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);
    const [confirmed, setConfirmed] = React.useState(false);

    // Load on open; drop everything on close so a second product never shows the
    // first one's variants for a frame.
    React.useEffect(() => {
        if (!open || !productId) {
            setProduct(null);
            setSelectedColor(null);
            setSelectedVariantId(null);
            setConfirmed(false);
            return;
        }

        let active = true;
        setIsLoading(true);
        getProductById(productId)
            .then((data) => {
                if (active) setProduct(data.product);
            })
            .catch(() => {
                if (active) toast.error("Could not load this product.");
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [open, productId]);

    const variants = React.useMemo(
        () => (product?.variants ?? []).filter(inStock),
        [product]
    );

    const colors = React.useMemo(() => {
        const map = new Map<string, { label: string; hex: string | null }>();
        for (const variant of variants) {
            const label = variant.color?.trim();
            if (!label) continue;
            const key = label.toLowerCase();
            if (!map.has(key)) {
                map.set(key, { label, hex: normalizeHex(variant.colorHex) });
            }
        }
        return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
    }, [variants]);

    const sizesForColor = React.useMemo(() => {
        const forColor = !selectedColor
            ? variants
            : variants.filter((variant) => (variant.color ?? "").toLowerCase() === selectedColor);
        return buildSizeOptions(forColor);
    }, [variants, selectedColor]);

    // Preselect anything unambiguous so a single-variant product needs no clicks.
    React.useEffect(() => {
        if (!open || variants.length === 0) return;
        // Any colour, not just a lone one: sizes belong to a colour, and with
        // none selected `sizesForColor` pools every colour's sizes into one
        // deduplicated row where a tap picks a colour the shopper never saw.
        if (!selectedColor && colors.length > 0) {
            const stocked = new Set(
                variants
                    .filter((variant) => (variant.inventory?.stock ?? 1) > 0)
                    .map((variant) => (variant.color ?? "").toLowerCase())
            );
            const preferred = colors.find((color) => stocked.has(color.key)) ?? colors[0];
            setSelectedColor(preferred.key);
        }
        if (variants.length === 1) {
            setSelectedVariantId(variants[0].id);
            return;
        }
        if (sizesForColor.length === 1) setSelectedVariantId(sizesForColor[0].variant.id);
    }, [open, variants, colors, selectedColor, sizesForColor]);

    const selectedVariant =
        variants.find((variant) => variant.id === selectedVariantId) ?? null;
    const heroImage = selectedVariant?.images?.[0] ?? product?.images?.[0] ?? null;

    // Close on Escape, and lock body scroll while open.
    React.useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose]);

    const handleConfirm = () => {
        if (!productId || !selectedVariant) return;

        if (!hasSession()) {
            onClose();
            toast.error("Please sign in to add items to cart.");
            startNavigationFeedback();
            router.push(loginUrlWithReturn());
            return;
        }

        const variantId = selectedVariant.id;
        const price = selectedVariant.price;

        // Optimistic, matching the product detail page: confirm now, reconcile in
        // the background, correct loudly if the server disagrees.
        setConfirmed(true);
        upsertCheckoutSnapshotItem({ variantId, quantity: 1, priceSnapshot: price });

        void addCartItem({ productId, variantId, quantity: 1 })
            .then((result) => {
                upsertCheckoutSnapshotItem({
                    variantId: result.item.variantId,
                    quantity: result.item.quantity,
                    priceSnapshot: result.item.priceSnapshot,
                });
            })
            .catch((error: unknown) => {
                removeCheckoutSnapshotItem(variantId);
                const message =
                    error instanceof Error ? error.message : "Unable to add to cart";
                if (/access token required|unauthorized/i.test(message)) {
                    toast.error("Your session expired — please sign in again.");
                    startNavigationFeedback();
                    router.push(loginUrlWithReturn());
                    return;
                }
                toast.error(`Couldn't add to cart: ${message}`, { duration: 8000 });
            });

        // A short beat so the confirmation registers, then move on.
        window.setTimeout(() => {
            onClose();
            startNavigationFeedback();
            router.push(intent === "buy" ? "/checkout" : "/cart");
        }, 320);
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Choose options"
        >
            <div
                onClick={(event) => event.stopPropagation()}
                className="max-h-[85vh] w-full overflow-y-auto border border-border-soft bg-card p-5 sm:max-w-md"
            >
                {isLoading ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        Loading…
                    </p>
                ) : !product ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        Could not load this product.
                    </p>
                ) : variants.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        This product is out of stock.
                    </p>
                ) : (
                    <>
                        <div className="flex items-start gap-3">
                            {heroImage ? (
                                <Image
                                    src={heroImage}
                                    alt={product.title}
                                    width={64}
                                    height={80}
                                    className="h-20 w-16 border border-border-soft object-cover"
                                />
                            ) : null}
                            <div className="flex-1">
                                <p className="font-serif text-base leading-snug text-foreground">
                                    {product.title}
                                </p>
                                <p className="mt-1 text-sm font-medium text-foreground">
                                    {currency.format(selectedVariant?.price ?? product.price ?? 0)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="p-1 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {colors.length > 1 ? (
                            <div className="mt-5">
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                    Colour
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {colors.map((color) => {
                                        const active = color.key === selectedColor;
                                        return (
                                            <button
                                                key={color.key}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedColor(color.key);
                                                    setSelectedVariantId(null);
                                                }}
                                                className={`flex items-center gap-2 border px-3 py-2 text-xs transition ${
                                                    active
                                                        ? "border-brand bg-mist text-foreground"
                                                        : "border-border-soft text-muted-foreground hover:border-brand/50"
                                                }`}
                                            >
                                                {color.hex ? (
                                                    <span
                                                        className="h-3 w-3 rounded-full border border-border-soft"
                                                        style={{ backgroundColor: color.hex }}
                                                    />
                                                ) : null}
                                                {color.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {sizesForColor.length > 1 ? (
                            <div className="mt-5">
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                    Size
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {sizesForColor.map((option) => {
                                        const active = option.variant.id === selectedVariantId;
                                        return (
                                            <button
                                                key={option.variant.id}
                                                type="button"
                                                disabled={!option.inStock}
                                                onClick={() => setSelectedVariantId(option.variant.id)}
                                                className={`min-w-13 border px-3 py-2 text-xs transition ${
                                                    !option.inStock
                                                        ? "cursor-not-allowed border-border-soft/60 text-muted-foreground/50 line-through"
                                                        : active
                                                          ? "border-brand bg-mist text-foreground"
                                                          : "border-border-soft text-muted-foreground hover:border-brand/50"
                                                }`}
                                            >
                                                {option.size}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        <CommerceFlowButton
                            action={intent === "buy" ? "buy" : "cart"}
                            variant={intent === "cart" ? "filled" : "outline"}
                            className="mt-6 font-semibold uppercase tracking-[0.12em]"
                            onClick={handleConfirm}
                            disabled={!selectedVariant || confirmed}
                        >
                            {confirmed
                                ? "Added to bag ✓"
                                : !selectedVariant
                                  ? "Select a size"
                                  : intent === "buy"
                                    ? "Buy Now"
                                    : "Add to Cart"}
                        </CommerceFlowButton>
                    </>
                )}
            </div>
        </div>
    );
}
