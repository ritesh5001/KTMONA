"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeftRight, ChevronDown, CircleHelp, Eye, Share2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommerceFlowButton } from "@/components/ui/commerce-flow-button";
import { toast } from "sonner";
import { addCartItem } from "@/services/cart";
import { createAppointment } from "@/services/appointments";
import { startNavigationFeedback } from "@/lib/navigation-feedback";
import {
  upsertCheckoutSnapshotItem,
  removeCheckoutSnapshotItem,
} from "@/lib/checkout-snapshot";
import { trackPendingCartWrite } from "@/lib/pending-cart";
import { loginUrlWithReturn } from "@/lib/login-redirect";
import { getSessionRole, hasSession } from "@/lib/session";
import { normalizeHex } from "@/lib/color-swatches";
import { buildSizeOptions } from "@/lib/variant-attributes";
import { SITE_URL } from "@/lib/site-config";

interface Variant {
  id: string;
  size: string;
  color?: string | null;
  colorHex?: string | null;
  images?: string[];
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  inventory?: {
    stock: number;
  } | null;
}

interface ProductDetailClientProps {
  product: {
    id: string;
    title: string;
    description?: string | null;
    category?: { name: string } | null;
    sellerId?: string;
    images?: string[];
    price?: number;
    regularPrice?: number;
    compareAtPrice?: number;
    sellerPrice?: number;
    adminPrice?: number;
    salePrice?: number;
    variants: Variant[];
  };
  onVariantImagesChange?: (images: string[]) => void;
}

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const range = (max - min) * 10;
  return min + (hash % range) / 10;
}

function formatDeliveryEstimate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

const colorClassMap: Record<string, string> = {
  white: "#ffffff",
  black: "#111111",
  navy: "#0f172a",
  blue: "#1d4ed8",
  beige: "#f5f5dc",
  cream: "#F8F1E5",
  grey: "#71717a",
  gray: "#71717a",
  maroon: "#7f1d1d",
  green: "#15803d",
};

function normalizeColor(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * The variant's colour, or "" when it has none. Empty is deliberate: a product
 * without a colour axis should show no swatch row at all rather than a
 * meaningless "Default" circle.
 */
function variantColorLabel(variant: Variant): string {
  return variant.color?.trim() || "";
}

function fallbackHexFromText(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  return `hsl(${hue} 55% 55%)`;
}

function swatchColorFromLabel(label: string): string {
  const normalized = normalizeColor(label);
  if (!normalized) return "#71717a";

  if (colorClassMap[normalized]) {
    return colorClassMap[normalized];
  }

  // Accept named CSS colors and hex/rgb/hsl values provided by seller input.
  if (
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized) ||
    /^rgb\(/i.test(normalized) ||
    /^hsl\(/i.test(normalized) ||
    /^[a-z][a-z\s-]*$/i.test(normalized)
  ) {
    return normalized;
  }

  return fallbackHexFromText(normalized);
}

/**
 * The variant a freshly opened page should land on: the smallest in-stock size
 * of the first colour, so the buyer never arrives on a struck-through chip.
 */
function pickDefaultVariant(variants: Variant[]): Variant | undefined {
  if (variants.length === 0) return undefined;

  const firstColor = normalizeColor(variantColorLabel(variants[0]!));
  const forFirstColor = variants.filter(
    (variant) => normalizeColor(variantColorLabel(variant)) === firstColor
  );
  const options = buildSizeOptions(forFirstColor);

  return (options.find((option) => option.inStock) ?? options[0])?.variant ?? variants[0];
}



export default function ProductDetailClient({
  product,
  onVariantImagesChange,
}: ProductDetailClientProps) {
  const router = useRouter();
  const [selectedColor, setSelectedColor] = React.useState("");
  const [selectedVariantId, setSelectedVariantId] = React.useState(
    () => pickDefaultVariant(product.variants ?? [])?.id ?? ""
  );
  const [buyNowLoading, setBuyNowLoading] = React.useState(false);
  const [pincode, setPincode] = React.useState("");
  const [deliveryMessage, setDeliveryMessage] = React.useState("");
  const [bookModalOpen, setBookModalOpen] = React.useState(false);
  const [appointmentDate, setAppointmentDate] = React.useState("");
  const [appointmentTime, setAppointmentTime] = React.useState("");
  const [booking, setBooking] = React.useState(false);

  const getLocalDateString = React.useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const minAppointmentDate = getLocalDateString();

  const handlePincodeCheck = () => {
    if (pincode.length === 6) {
      const days1 = Math.floor(Math.random() * 3) + 4; // 4 to 6
      const days2 = days1 + Math.floor(Math.random() * 2) + 1; // + 1-2 days
      setDeliveryMessage(`Expected Delivery in ${days1}-${days2} days`);
    } else {
      setDeliveryMessage("Please enter a valid 6-digit pincode.");
    }
  };

  React.useEffect(() => {
    router.prefetch("/checkout");
  }, [router]);

  const colorOptions = React.useMemo(() => {
    const map = new Map<string, { label: string; hex: string | null }>();
    for (const variant of product.variants ?? []) {
      const label = variantColorLabel(variant);
      if (!label) continue;
      const key = normalizeColor(label);
      const hex = normalizeHex(variant.colorHex);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { label, hex });
      } else if (!existing.hex && hex) {
        // Any size of this colour carrying the admin-picked swatch wins.
        existing.hex = hex;
      }
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [product.variants]);

  React.useEffect(() => {
    const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
    if (selectedVariant) {
      setSelectedColor(normalizeColor(variantColorLabel(selectedVariant)));
      return;
    }

    const first = pickDefaultVariant(product.variants);
    if (first) {
      setSelectedVariantId(first.id);
      setSelectedColor(normalizeColor(variantColorLabel(first)));
      return;
    }

    setSelectedColor("");
  }, [product.variants, selectedVariantId]);

  const variantsForColor = React.useMemo(() => {
    if (!selectedColor) return product.variants;
    return product.variants.filter(
      (variant) => normalizeColor(variantColorLabel(variant)) === selectedColor
    );
  }, [product.variants, selectedColor]);

  /** One chip per size of the selected colour, in scale order with live stock. */
  const sizeOptions = React.useMemo(
    () => buildSizeOptions(variantsForColor),
    [variantsForColor]
  );

  const selectedColorLabel =
    colorOptions.find((color) => color.key === selectedColor)?.label ?? "";

  const selectedVariant = product.variants.find(
    (variant) => variant.id === selectedVariantId
  );
  const salePrice = selectedVariant?.price ?? product.salePrice ?? product.adminPrice ?? product.price;
  // Only treat the backend's compare-at as "real" when it's strictly greater than sale.
  const candidateCompareAt =
    selectedVariant?.compareAtPrice ?? product.compareAtPrice ?? product.regularPrice ?? null;
  const realCompareAt =
    typeof candidateCompareAt === "number" &&
    typeof salePrice === "number" &&
    candidateCompareAt > salePrice
      ? candidateCompareAt
      : null;
  const fakeCompareAt =
    realCompareAt === null && typeof salePrice === "number" && salePrice > 0
      ? Math.round(salePrice / (1 - Math.round(seededRandom(product.id + "m", 50, 75)) / 100) / 10) * 10
      : null;
  const compareAtPrice = realCompareAt ?? fakeCompareAt;
  const rating = Math.round(seededRandom(product.id, 39, 48)) / 10;
  const reviewCount = Math.round(seededRandom(product.id + "r", 50, 500));
  const deliveryEstimate = formatDeliveryEstimate(6);
  const selectedColorImages = React.useMemo(() => {
    const selectedVariantImages =
      selectedVariant?.images?.filter(
        (image): image is string => typeof image === "string" && image.trim().length > 0
      ) ?? [];

    if (selectedVariantImages.length > 0) {
      return selectedVariantImages;
    }

    const firstColorImageSet =
      variantsForColor.find(
        (variant) => Array.isArray(variant.images) && variant.images.length > 0
      )?.images ?? [];

    return firstColorImageSet.length > 0
      ? firstColorImageSet
      : product.images?.length
        ? product.images
        : [];
  }, [product.images, selectedVariant, variantsForColor]);

  React.useEffect(() => {
    if (!onVariantImagesChange) return;

    const nextImages = selectedColorImages.length
      ? selectedColorImages
      : product.images?.length
        ? product.images
        : ["/images/product-placeholder.svg"];

    onVariantImagesChange(nextImages);
  }, [onVariantImagesChange, product.images, selectedColorImages]);
  const hasDiscount =
    typeof compareAtPrice === "number" &&
    typeof salePrice === "number" &&
    compareAtPrice > salePrice;
  const savingsAmount = hasDiscount ? compareAtPrice - salePrice : 0;
  const discountPercent = hasDiscount
    ? Math.round(((compareAtPrice - salePrice) / compareAtPrice) * 100)
    : 0;

  const handleAddToCart = async () => {
    if (!selectedVariant) {
      toast.error("Please choose a variant first.");
      return;
    }

    if (!hasSession()) {
      toast.error("Please sign in to add items to cart.");
      startNavigationFeedback();
      router.push(loginUrlWithReturn());
      return;
    }

    // Optimistic. Adding to a cart is a single insert that essentially only fails on
    // an expired session or a sold-out variant, and blocking the button on a
    // cross-region round-trip made a one-tap action feel broken. Confirm now, reconcile
    // in the background, and correct loudly if the server disagrees.
    const variantId = selectedVariant.id;
    toast.success("Added to cart.");
    if (typeof salePrice === "number") {
      // Only seed the snapshot when we know the price — a placeholder would show a
      // wrong estimated total on /checkout. The server response corrects it below.
      upsertCheckoutSnapshotItem({
        variantId,
        quantity: 1,
        priceSnapshot: salePrice,
      });
    }

    void addCartItem({
      productId: product.id,
      variantId,
      quantity: 1,
    })
      .then((result) => {
        // Replace the guess with what the server actually stored.
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
  };

  const handleBuyNow = async () => {
    if (!selectedVariant) {
      toast.error("Please choose a variant first.");
      return;
    }

    if (!hasSession()) {
      toast.error("Please sign in to continue.");
      startNavigationFeedback();
      router.push(loginUrlWithReturn());
      return;
    }

    // Navigate FIRST. The add-to-cart round-trip used to block the transition, so
    // the buyer sat on the product page for its full duration. The request keeps
    // running across the client-side navigation and /checkout waits for it before
    // reading the cart or placing the order — instant, without a race.
    const variantId = selectedVariant.id;
    if (typeof salePrice === "number") {
      upsertCheckoutSnapshotItem({
        variantId,
        quantity: 1,
        priceSnapshot: salePrice,
      });
    }

    const cartWrite = addCartItem({
      productId: product.id,
      variantId,
      quantity: 1,
    }).then((result) => {
      // Replace the optimistic guess with what the server actually stored.
      upsertCheckoutSnapshotItem({
        variantId: result.item.variantId,
        quantity: result.item.quantity,
        priceSnapshot: result.item.priceSnapshot,
      });
      return result;
    });

    trackPendingCartWrite(cartWrite);

    startNavigationFeedback();
    router.push("/checkout");

    setBuyNowLoading(true);
    try {
      await cartWrite;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to continue to checkout";
      if (/access token required|unauthorized/i.test(message)) {
        toast.error("Please sign in to continue.");
        startNavigationFeedback();
        router.push(loginUrlWithReturn());
        return;
      }
      toast.error(message);
    } finally {
      setBuyNowLoading(false);
    }
  };

  const handleShareProduct = async () => {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `${SITE_URL}/product/${product.id}`;
    const title = product.title?.trim() || "KTMONA product";

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title,
          text: title,
          url,
        });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success("Product link copied.");
        return;
      }

      toast.info(url);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Unable to share this product.");
    }
  };

  const handleOpenBooking = () => {
    const role = getSessionRole() ?? "";

    if (!hasSession() || role !== "USER") {
      toast.error("Please sign in as a customer to book a video call.");
      startNavigationFeedback();
      router.push(loginUrlWithReturn());
      return;
    }

    if (!product.sellerId) {
      toast.error("Seller details are unavailable for this product.");
      return;
    }

    setBookModalOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!appointmentDate || !appointmentTime) {
      toast.error("Please select both date and time.");
      return;
    }

    const selectedDateTime = new Date(`${appointmentDate}T${appointmentTime}:00`);
    if (Number.isNaN(selectedDateTime.getTime())) {
      toast.error("Please choose a valid date and time.");
      return;
    }

    if (appointmentDate < minAppointmentDate) {
      toast.error("Please choose today or a future date.");
      return;
    }

    if (selectedDateTime.getTime() <= Date.now()) {
      toast.error("Please choose a future time slot.");
      return;
    }

    if (!product.sellerId) {
      toast.error("Seller details are unavailable for this product.");
      return;
    }

    setBooking(true);
    try {
      await createAppointment({
        sellerId: product.sellerId,
        productId: product.id,
        date: appointmentDate,
        time: appointmentTime,
      });
      toast.success("Video appointment booked.");
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "ktmona_appointment_alert",
          "Your appointment is booked successfully.",
        );
      }
      setBookModalOpen(false);
      setAppointmentDate("");
      setAppointmentTime("");
      startNavigationFeedback();
      router.push("/user/appointments");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to book appointment");
    } finally {
      setBooking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex min-w-0 max-w-full flex-col justify-center overflow-x-clip py-4 sm:py-6 lg:py-12"
    >
      {/* Editorial Content Block */}
      {/* Editorial Content Block */}
      <div className="space-y-6">
        {/* 1. Title */}
        <h1 className="break-words font-serif text-2xl font-light leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl xl:text-5xl">
          {product.title}
        </h1>

        {/* 1b. Rating + reviews */}
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 bg-emerald-700 text-white px-2 py-0.5 text-xs font-semibold">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {rating.toFixed(1)}
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">{reviewCount} reviews</span>
        </div>

        {/* 2. Price & SKU */}
        <div className="space-y-2 pt-1 border-b border-border-soft pb-6">
          <div className="flex items-baseline gap-3 relative">
            <span className="font-serif text-3xl font-medium text-foreground sm:text-4xl">
              {typeof salePrice === "number" ? currency.format(salePrice) : "—"}
            </span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {currency.format(compareAtPrice)}
              </span>
            )}
            {hasDiscount && (
              <span className="rounded-full bg-[#d85025]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#d85025]">
                {discountPercent}% off
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-2 uppercase tracking-wide">MRP (Inclusive of all taxes)</span>
          </div>
          {hasDiscount && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#b03d19]">
              You save {currency.format(savingsAmount)} + limited-time offer
            </p>
          )}
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest pt-2">
            SKU ID- {selectedVariant?.sku ?? product.variants[0]?.sku ?? "N/A"}
          </p>
        </div>

        {/* 3. Colour Selection — hidden entirely when the product has no colour axis. */}
        {colorOptions.length > 0 && (
          <div className="space-y-4 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground">
              SELECT COLOUR
              {selectedColorLabel && (
                <span className="ml-2 text-muted-foreground normal-case tracking-normal">
                  {selectedColorLabel}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-4 mt-2">
              {colorOptions.map((color) => {
                const active = color.key === selectedColor;
                // Admin-picked swatch first; the name-derived guess is the fallback.
                const swatchColor = color.hex ?? swatchColorFromLabel(color.label);
                return (
                  <button
                    key={color.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedColor(color.key);
                      const forColor = product.variants.filter(
                        (variant) => normalizeColor(variantColorLabel(variant)) === color.key
                      );
                      // Stay on the size the buyer already chose when the new
                      // colour stocks it; only then fall back to its first size.
                      const sameSize = forColor.find(
                        (variant) => variant.size === selectedVariant?.size
                      );
                      const next = sameSize ?? buildSizeOptions(forColor)[0]?.variant;
                      if (next) setSelectedVariantId(next.id);
                    }}
                    className={`flex w-[72px] flex-col items-center gap-2 transition-all hover:opacity-90 ${active ? 'text-foreground' : 'text-muted-foreground'}`}
                    title={color.label}
                  >
                    <div
                      className={`h-9 w-9 rounded-full border sm:h-10 sm:w-10 lg:h-11 lg:w-11 ${active ? 'border-brand ring-2 ring-brand/25' : 'border-border-soft'}`}
                      style={{ backgroundColor: swatchColor }}
                    />
                    <span className={`w-full text-center text-[10px] font-medium uppercase tracking-[0.12em] leading-tight sm:text-[11px] ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {color.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Size Selection */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground">
              SELECT SIZE
            </p>
            <button className="flex items-center gap-1.5 text-[11px] text-foreground underline decoration-1 underline-offset-4 hover:text-brand-strong transition-colors tracking-wide">
              <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.5} />
              Size Chart
            </button>
          </div>

          <div className="flex flex-wrap gap-2.5 mt-2">
            {sizeOptions.length === 0 ? (
              <span className="text-sm text-muted-foreground">Variants coming soon</span>
            ) : (
              sizeOptions.map((option) => (
                <motion.button
                  key={option.variant.id}
                  type="button"
                  disabled={!option.inStock}
                  aria-pressed={selectedVariantId === option.variant.id}
                  onClick={() => setSelectedVariantId(option.variant.id)}
                  whileHover={option.inStock ? { y: -1 } : undefined}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`relative px-5 py-3 text-xs font-medium uppercase tracking-wider transition-all duration-300 min-w-14
                     ${!option.inStock
                      ? "cursor-not-allowed border border-border-soft/60 text-muted-foreground/50 line-through"
                      : selectedVariantId === option.variant.id
                        ? "border border-brand bg-mist text-ink dark:bg-navy/30 dark:text-paper"
                        : "border border-border-soft text-muted-foreground hover:border-brand/50 hover:text-foreground"
                    }`}
                >
                  {option.size}
                  {option.lowStock !== null && (
                    <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#d85025] text-white text-[9px] font-semibold px-2 py-0.5 rounded-sm shadow-sm whitespace-nowrap z-10 tracking-widest">
                      {option.lowStock} Left
                    </span>
                  )}
                </motion.button>
              ))
            )}
          </div>
        </div>

        {/* 5. Views Counter */}
        <div className="flex items-center gap-2 pt-6 pb-2 text-[13px] text-foreground">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <span className="font-medium tracking-wide">{Math.round(seededRandom(product.id + "v", 200, 900))}</span> people have viewed the product recently
        </div>

        {/* 6. Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <div className="flex-1">
            <CommerceFlowButton
              action="cart"
              variant="filled"
              onClick={handleAddToCart}
              disabled={buyNowLoading}
              className="font-semibold uppercase tracking-[0.12em]"
            >
              Add to Cart
            </CommerceFlowButton>
          </div>

          <div className="flex-1">
            <CommerceFlowButton
              action="buy"
              variant="outline"
              onClick={handleBuyNow}
              disabled={buyNowLoading}
              className="font-semibold uppercase tracking-[0.12em]"
            >
              {buyNowLoading ? "Processing..." : "Buy Now"}
            </CommerceFlowButton>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleShareProduct}
            className="h-12 w-full gap-2 border border-border-soft text-[12px] font-medium uppercase tracking-[0.12em] text-foreground hover:border-brand/50 hover:bg-brand/5"
          >
            <Share2 className="h-4 w-4" strokeWidth={1.6} />
            Share
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenBooking}
            className="h-12 w-full border border-brand/40 text-[12px] font-medium uppercase tracking-[0.12em] text-foreground hover:bg-brand/5"
          >
            Book Video Call
          </Button>
        </div>

        {/* 7. Pincode Check */}
        <div className="pt-6 relative">
          <div className="flex flex-col gap-2">
            <div className="flex items-center border border-border-soft overflow-hidden h-14 transition-colors focus-within:border-brand">
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setPincode(val);
                  if (val.length < 6) setDeliveryMessage("");
                }}
                placeholder="Enter pincode"
                className="flex-1 bg-transparent px-5 py-2 outline-none text-[13px] placeholder:text-muted-foreground tracking-wide font-medium"
              />
              <button
                onClick={handlePincodeCheck}
                disabled={pincode.length !== 6}
                className="h-full border-l border-border-soft px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-border-soft/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-8 sm:text-[12px] sm:tracking-[0.15em]"
              >
                Check
              </button>
            </div>
            {deliveryMessage && (
              <p className="text-xs font-medium text-green-600 dark:text-green-500 px-1 animate-in fade-in slide-in-from-top-1">
                {deliveryMessage}
              </p>
            )}
          </div>
        </div>

        {/* 7b. Delivery estimate + offers */}
        <div className="border border-border-soft bg-mist/40 dark:bg-navy/10 p-4 space-y-3">
          <div className="flex items-center gap-3 text-[13px]">
            <Truck className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" strokeWidth={1.6} />
            <span className="text-foreground">
              Get it by <strong className="font-semibold">{deliveryEstimate}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <svg className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <span className="text-foreground">
              Use code <strong className="font-semibold tracking-wide">WELCOME5</strong> for extra 5% off on first order
            </span>
          </div>
        </div>

        {/* 8. Delivery Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-10 pb-6 border-b border-border-soft">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 flex items-center justify-center rounded-full bg-accent text-brand-strong shrink-0 border border-brand/10">
              <Truck className="h-5.5 w-5.5" strokeWidth={1.35} />
            </div>
            <p className="text-[14px] font-medium leading-tight text-foreground">Free delivery<br /><span className="text-[13px] text-muted-foreground font-normal">within 2-3 days</span></p>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 flex items-center justify-center rounded-full bg-accent text-brand-strong shrink-0 border border-brand/10">
              <ArrowLeftRight className="h-5.5 w-5.5" strokeWidth={1.35} />
            </div>
            <p className="text-[14px] font-medium leading-tight text-foreground">Easy Exchange in<br /><span className="text-[13px] text-muted-foreground font-normal">10 days</span></p>
          </div>
        </div>

        {/* 9. Accordions */}
        <div className="pt-2 space-y-0 text-[13px] text-muted-foreground">
          <details className="border-b border-border-soft group list-none [&::-webkit-details-marker]:hidden" open>
            <summary className="flex w-full items-center justify-between py-5 text-[12px] font-bold uppercase tracking-[0.15em] text-foreground hover:text-brand-strong transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Product Details
              <ChevronDown className="h-4.5 w-4.5 transition-transform group-open:rotate-180" strokeWidth={1.5} />
            </summary>
            <div className="pb-5 space-y-3 animate-in fade-in slide-in-from-top-2">
              <p className="leading-relaxed">
                {product.description || "Indulge in the finest craftsmanship with this stunning piece, designed to stand out. Impeccably tailored to match the highest standards."}
              </p>
              <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-border-soft pt-4 sm:grid-cols-2">
                <li><strong className="text-foreground uppercase text-[10px] tracking-widest font-bold">Category:</strong> {product.category?.name || "Curated Collection"}</li>
                <li><strong className="text-foreground uppercase text-[10px] tracking-widest font-bold">Color:</strong> Multi Variation</li>
                <li><strong className="text-foreground uppercase text-[10px] tracking-widest font-bold">Material:</strong> Premium Blend</li>
                <li><strong className="text-foreground uppercase text-[10px] tracking-widest font-bold">Fit:</strong> Regular Fit</li>
                <li><strong className="text-foreground uppercase text-[10px] tracking-widest font-bold">Care:</strong> Dry Clean Only</li>
                <li><strong className="text-foreground uppercase text-[10px] tracking-widest font-bold">Origin:</strong> Made in India</li>
              </ul>
            </div>
          </details>

          <details className="border-b border-border-soft group list-none [&::-webkit-details-marker]:hidden">
            <summary className="flex w-full items-center justify-between py-5 text-[12px] font-bold uppercase tracking-[0.15em] text-foreground hover:text-brand-strong transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Product Declaration
              <ChevronDown className="h-4.5 w-4.5 transition-transform group-open:rotate-180" strokeWidth={1.5} />
            </summary>
            <div className="pb-5 space-y-3 animate-in fade-in slide-in-from-top-2">
              <p className="leading-relaxed">
                All our products are listed by verified sellers and checked by the KTMONA team. Colors may slightly vary from the pictures due to lighting conditions and varying screen display resolutions.
              </p>
            </div>
          </details>

          <details className="border-b border-border-soft group list-none [&::-webkit-details-marker]:hidden">
            <summary className="flex w-full items-center justify-between py-5 text-[12px] font-bold uppercase tracking-[0.15em] text-foreground hover:text-brand-strong transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Shipping & Returns
              <ChevronDown className="h-4.5 w-4.5 transition-transform group-open:rotate-180" strokeWidth={1.5} />
            </summary>
            <div className="pb-5 space-y-3 animate-in fade-in slide-in-from-top-2">
              <p className="leading-relaxed">
                We offer free PAN-India delivery across all major pincodes. Typical dispatch times range from 24-48 hours. Items can be exchanged or returned within 10 days of delivery, provided they remain unworn, with tags intact and in their original packaging.
              </p>
            </div>
          </details>
        </div>
      </div>

      {bookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md border border-border-soft bg-card p-6 shadow-xl">
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-brand-strong">WhatsApp Consultation</p>
              <h3 className="mt-2 font-serif text-2xl font-light text-foreground">Book Video Call</h3>
              <p className="mt-2 text-sm text-muted-foreground">Select your preferred date and time for the seller video call.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Date
                </label>
                <input
                  type="date"
                  min={minAppointmentDate}
                  value={appointmentDate}
                  onChange={(event) => setAppointmentDate(event.target.value)}
                  className="h-11 w-full border border-border-soft bg-background px-3 text-sm text-foreground outline-none focus:border-brand/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Time
                </label>
                <input
                  type="time"
                  value={appointmentTime}
                  onChange={(event) => setAppointmentTime(event.target.value)}
                  className="h-11 w-full border border-border-soft bg-background px-3 text-sm text-foreground outline-none focus:border-brand/50"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setBookModalOpen(false)}
                disabled={booking}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleConfirmBooking}
                disabled={booking}
              >
                {booking ? "Booking..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
