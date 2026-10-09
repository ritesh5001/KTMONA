import Link from "next/link";
import { PriceLockBadge } from "@/components/storefront/ProductTile";
import Image from "next/image";
import { QuickBuyButton } from "@/components/quick-buy-button";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export interface MarketplaceCardProduct {
  id: string;
  /** Bestsellers use `productId` instead of `id` for wishlist */
  productId?: string;
  title: string;
  images?: string[];
  /** Bestsellers use `image` (single) instead of `images` */
  image?: string | null;
  category?: { id?: string; name: string } | null;
  /** Bestsellers use `categoryName` string */
  categoryName?: string | null;
  salePrice?: number | null;
  adminPrice?: number | null;
  price?: number | null;
  compareAtPrice?: number | null;
  regularPrice?: number | null;
  sellerPrice?: number | null;
  adminListingPrice?: number | null;
  minPrice?: number | null;
  activeCoupon?: MarketplaceCardCouponPreview | null;
  /** KTMONA Price Lock badge (lowest market price, verified). */
  priceLock?: boolean;
  coupon?: MarketplaceCardCouponPreview | null;
  couponPreview?: MarketplaceCardCouponPreview | null;
  coupons?: MarketplaceCardCouponPreview[] | null;
  availableSizes?: string[] | null;
  sizes?: string[] | string | null;
  variants?: Array<{ sku?: string | null }> | null;
}

type CouponKind = "PERCENT" | "FLAT";

interface MarketplaceCardCouponPreview {
  code?: string;
  type?: CouponKind | string | null;
  value?: number | null;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  discountedPrice?: number | null;
  finalPrice?: number | null;
  isActive?: boolean | null;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveCouponCandidates(product: MarketplaceCardProduct): MarketplaceCardCouponPreview[] {
  const candidates: MarketplaceCardCouponPreview[] = [];

  if (product.activeCoupon) candidates.push(product.activeCoupon);
  if (product.coupon) candidates.push(product.coupon);
  if (product.couponPreview) candidates.push(product.couponPreview);
  if (Array.isArray(product.coupons)) candidates.push(...product.coupons);

  return candidates.filter((coupon) => coupon && coupon.isActive !== false);
}

function resolveCouponPrice(product: MarketplaceCardProduct, displayPrice: number | null): number | null {
  if (displayPrice === null || displayPrice <= 0) return null;

  const candidates = resolveCouponCandidates(product);
  let bestCouponPrice: number | null = null;

  for (const coupon of candidates) {
    const directDiscountedPrice = toNumber(coupon.discountedPrice) ?? toNumber(coupon.finalPrice);

    if (directDiscountedPrice !== null && directDiscountedPrice > 0 && directDiscountedPrice < displayPrice) {
      bestCouponPrice =
        bestCouponPrice === null ? directDiscountedPrice : Math.min(bestCouponPrice, directDiscountedPrice);
      continue;
    }

    const value = toNumber(coupon.value);
    if (value === null || value <= 0) continue;

    const minOrderAmount = toNumber(coupon.minOrderAmount) ?? 0;
    if (displayPrice < minOrderAmount) continue;

    const normalizedType = String(coupon.type ?? "").toUpperCase();
    let discountAmount = normalizedType === "PERCENT" ? (displayPrice * value) / 100 : value;

    const maxDiscountAmount = toNumber(coupon.maxDiscountAmount);
    if (maxDiscountAmount !== null) {
      discountAmount = Math.min(discountAmount, maxDiscountAmount);
    }

    const discountedPrice = Math.max(0, displayPrice - discountAmount);
    if (discountedPrice < displayPrice) {
      bestCouponPrice = bestCouponPrice === null ? discountedPrice : Math.min(bestCouponPrice, discountedPrice);
    }
  }

  if (bestCouponPrice === null) return null;
  return Math.round(bestCouponPrice * 100) / 100;
}

function resolvePrimaryPrice(product: MarketplaceCardProduct): number | null {
  const value =
    product.adminPrice ??
    product.adminListingPrice ??
    product.salePrice ??
    product.price ??
    product.minPrice ??
    product.sellerPrice;
  return typeof value === "number" ? value : null;
}

function resolveOriginalPrice(product: MarketplaceCardProduct, displayPrice: number | null): number | null {
  if (displayPrice === null) return null;

  const value = product.compareAtPrice ?? product.regularPrice;
  if (typeof value !== "number") return null;

  return value > displayPrice ? value : null;
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"] as const;

function normalizeSizeToken(value: string): string | null {
  const token = value.trim().toUpperCase();
  if (!token) return null;
  if (token === "ONE SIZE" || token === "FREE SIZE") return "FREE";
  return token;
}

function resolveAvailableSizes(product: MarketplaceCardProduct): string[] {
  const candidates: string[] = [];

  if (Array.isArray(product.availableSizes)) {
    candidates.push(...product.availableSizes);
  }

  if (Array.isArray(product.sizes)) {
    candidates.push(...product.sizes);
  } else if (typeof product.sizes === "string") {
    candidates.push(...product.sizes.split(","));
  }

  if (Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      const sku = typeof variant?.sku === "string" ? variant.sku : "";
      const lastToken = sku.split("-").pop() ?? "";
      if (lastToken) candidates.push(lastToken);
    }
  }

  const unique = Array.from(new Set(candidates.map((value) => normalizeSizeToken(String(value) ?? "")).filter((value): value is string => Boolean(value))));

  return unique.sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a as (typeof SIZE_ORDER)[number]);
    const bi = SIZE_ORDER.indexOf(b as (typeof SIZE_ORDER)[number]);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function formatSizesLabel(sizes: string[]): string {
  if (sizes.length === 0) return "View options";
  const visible = sizes.slice(0, 4).join(", ");
  const hidden = sizes.length - 4;
  return hidden > 0 ? `${visible} +${hidden}` : visible;
}

function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const range = (max - min) * 10;
  return min + (hash % range) / 10;
}

export function MarketplaceProductCard({ product }: { product: MarketplaceCardProduct }) {
  const displayPrice = resolvePrimaryPrice(product);
  const realOriginalPrice = resolveOriginalPrice(product, displayPrice);
  const couponPrice = resolveCouponPrice(product, displayPrice);
  const availableSizes = resolveAvailableSizes(product);
  const rating = Math.round(seededRandom(product.id, 39, 48)) / 10;
  const reviewCount = Math.round(seededRandom(product.id + "r", 50, 500));

  const originalPrice = (() => {
    if (typeof realOriginalPrice === "number") return realOriginalPrice;
    if (typeof displayPrice !== "number" || displayPrice <= 0) return null;
    const fakeDiscount = Math.round(seededRandom(product.id + "m", 50, 75));
    return Math.round(displayPrice / (1 - fakeDiscount / 100) / 10) * 10;
  })();

  const discountPercentage =
    typeof displayPrice === "number" && typeof originalPrice === "number" && originalPrice > 0
      ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
      : null;

  const imageSrc = product.images?.[0] ?? product.image ?? "/images/product-placeholder.svg";
  const categoryLabel = product.category?.name ?? product.categoryName ?? "Collection";
  const hasDiscount = typeof discountPercentage === "number" && discountPercentage > 0;

  return (
    <article
      className="block overflow-hidden rounded-xl border border-border-soft/80 bg-card/95 shadow-[0_6px_24px_rgba(17,12,8,0.08)] sm:rounded-2xl"
    >
      <Link href={`/product/${product.id}`} prefetch className="block">
        <div className="relative overflow-hidden bg-mist dark:bg-navy/20 aspect-3/4">
          <Image
            src={imageSrc}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
            loading="lazy"
            quality={75}
          />

          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/18 via-transparent to-transparent opacity-70" />

          <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
            {product.priceLock ? (
              <PriceLockBadge />
            ) : (
              <span className="inline-flex items-center bg-white/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/80 backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.18em]">
                Trending
              </span>
            )}
          </div>

          <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3">
            <span className="inline-flex items-center gap-1 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-foreground/90 shadow-sm backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[11px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#16a34a" aria-hidden="true" className="shrink-0">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span>{rating.toFixed(1)}</span>
              <span className="text-muted-foreground/60">|</span>
              <span className="text-muted-foreground/80">{reviewCount}</span>
            </span>
          </div>

          {hasDiscount && (
            <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
              <span className="inline-flex items-center rounded-full bg-amber-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white shadow-sm sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.12em]">
                {discountPercentage}% OFF
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-1.5 px-3 pb-3 pt-3 sm:space-y-2 sm:px-4 sm:pb-4.5 sm:pt-3.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85 sm:text-[10px] sm:tracking-[0.16em]">
          {categoryLabel}
        </p>

        <Link href={`/product/${product.id}`} prefetch className="block">
          <h3 className="line-clamp-2 min-h-[2.35rem] text-[0.96rem] font-semibold leading-tight tracking-tight text-foreground sm:min-h-[2.6rem] sm:text-[1.04rem]">
            {product.title}
          </h3>
        </Link>

        {typeof displayPrice === "number" ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5" suppressHydrationWarning>
              <span className="text-[0.97rem] font-bold leading-none text-foreground" suppressHydrationWarning>
                {currency.format(displayPrice)}
              </span>
              {typeof originalPrice === "number" && (
                <span className="text-[0.80rem] text-muted-foreground/75 line-through decoration-foreground/35 decoration-1" suppressHydrationWarning>
                  {currency.format(originalPrice)}
                </span>
              )}
              {hasDiscount && (
                <span className="text-[0.75rem] font-semibold text-amber-700 dark:text-amber-400">
                  ({discountPercentage}% OFF)
                </span>
              )}
            </div>

            {typeof couponPrice === "number" && couponPrice < displayPrice && (
              <div className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.06em]" suppressHydrationWarning>
                <span suppressHydrationWarning>Get it for {currency.format(couponPrice)}</span>
                <span className="text-emerald-700/85 dark:text-emerald-300/85">with coupon</span>
              </div>
            )}

            <p className="line-clamp-1 text-[10px] font-medium tracking-[0.02em] text-muted-foreground/90 sm:text-[11px]">
              <span className="font-semibold text-foreground/85">Available Sizes:</span>{" "}
              {formatSizesLabel(availableSizes)}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-muted-foreground">Price on request</p>
            <p className="line-clamp-1 text-[10px] font-medium tracking-[0.02em] text-muted-foreground/90 sm:text-[11px]">
              <span className="font-semibold text-foreground/85">Available Sizes:</span> View options
            </p>
          </>
        )}

        {/* Opens the size picker in place — this used to be a link to the product
            page, so "Add to Cart" never actually added anything. */}
        <QuickBuyButton
          productId={product.id}
          label="Add to Cart"
          className="mt-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] sm:mt-2 sm:text-xs sm:tracking-[0.14em]"
        />
      </div>
    </article>
  );
}
