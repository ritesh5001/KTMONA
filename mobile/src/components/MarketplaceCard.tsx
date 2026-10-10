import * as React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "../i18n/Text";
import { Icon } from "./Icon";
import { FlowActionButton } from "./FlowActionButton";
import { Image } from "./CompatImage";
import { colors, typography, spacing, radius } from "../theme/tokens";
import { images } from "../data/images";
import { type ProductItem } from "../services/products";
import { useWishlist } from "../providers/WishlistProvider";
import { rememberProductSeed } from "../lib/product-seed";

interface MarketplaceCardProps {
  product: ProductItem;
  onPress?: (id: string) => void;
  onTryAndBuy?: (productId: string) => void;
  /** Opens the quick-buy sheet instead of navigating to the product page. */
  onQuickAdd?: (productId: string) => void;
  onBuyNow?: (productId: string) => void;
  onRemove?: (id: string) => void;
  removing?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Rendered width of the card in dp, so the CDN can return a matching image.
   * Without it the card downloads the full-resolution original — several times
   * the bytes and the decode cost, for a thumbnail. Callers that size the card
   * via `style` should pass the same number here.
   */
  imageWidth?: number;
}

/** Two cards per row on a phone, so never wider than about half the screen. */
const DEFAULT_CARD_IMAGE_WIDTH = 220;

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Matches the storefront's stable fallback discount for products without a higher MRP. */
function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const range = (max - min) * 10;
  return min + (hash % range) / 10;
}

function MarketplaceCardComponent({
  product,
  onPress,
  onTryAndBuy,
  onQuickAdd,
  onBuyNow,
  onRemove,
  removing = false,
  style,
  imageWidth = DEFAULT_CARD_IMAGE_WIDTH,
}: MarketplaceCardProps) {
  const { isWishlisted, toggleWishlist, mutatingIds } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  const wishlistBusy = mutatingIds.has(product.id);

  // Keep a genuine sale price first, then the public admin-set selling price.
  // `sellerPrice` remains a last-resort compatibility fallback; it must never be
  // used as the MRP because it represents seller economics on legacy payloads.
  const primaryPrice =
    product.salePrice ??
    product.adminPrice ??
    product.adminListingPrice ??
    product.price ??
    product.minPrice ??
    product.sellerPrice ??
    null;

  const catalogueOriginalPrice =
    typeof primaryPrice === "number"
      ? [product.compareAtPrice, product.regularPrice].reduce<number | null>(
          (highest, candidate) =>
            typeof candidate === "number" && candidate > primaryPrice
              ? Math.max(highest ?? candidate, candidate)
              : highest,
          null
        )
      : null;

  const originalPrice = (() => {
    if (catalogueOriginalPrice !== null) return catalogueOriginalPrice;
    if (typeof primaryPrice !== "number" || primaryPrice <= 0) return null;

    const fallbackDiscount = Math.round(seededRandom(`${product.id}m`, 50, 75));
    return Math.round(primaryPrice / (1 - fallbackDiscount / 100) / 10) * 10;
  })();

  const hasDiscount =
    typeof primaryPrice === "number" &&
    typeof originalPrice === "number" &&
    originalPrice > primaryPrice;

  const discountPercentage =
    hasDiscount && originalPrice > 0
      ? ((originalPrice - primaryPrice) / originalPrice) * 100
      : null;
  const discountLabel =
    discountPercentage === null
      ? null
      : discountPercentage < 1
        ? "<1% OFF"
        : `${Math.round(discountPercentage)}% OFF`;

  // Keep the review treatment stable between renders and aligned with the web
  // storefront card until aggregate review fields are included in list APIs.
  const rating = Math.round(seededRandom(product.id, 39, 48)) / 10;
  const reviewCount = Math.round(seededRandom(`${product.id}r`, 50, 500));

  const firstImage =
    Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;

  const handlePress = () => {
    // The detail screen renders title, image, category and price from exactly
    // this record, so hand it over before navigating. Doing it here rather than
    // at each call site means every list that uses this card gets an instant
    // detail page, including ones added later.
    rememberProductSeed(product);
    onPress?.(product.id);
  };
  const handleTryAndBuy = React.useCallback(() => {
    onTryAndBuy?.(product.id);
  }, [onTryAndBuy, product.id]);
  const handleRemove = () => onRemove?.(product.id);
  const handleToggleWishlist = () => {
    toggleWishlist(product.id);
  };

  const productAccessibilityLabel = React.useMemo(() => {
    const priceLabel =
      typeof primaryPrice === "number"
        ? `current price ${currency.format(primaryPrice)}`
        : "price on request";
    const mrpLabel =
      typeof originalPrice === "number"
        ? `, MRP ${currency.format(originalPrice)}`
        : "";
    const savingsLabel = discountLabel
      ? `, ${discountLabel.replace("<", "less than ").toLowerCase()}`
      : "";
    return `${product.title}, rated ${rating.toFixed(1)} out of 5 from ${reviewCount} reviews, ${priceLabel}${mrpLabel}${savingsLabel}. View product details`;
  }, [discountLabel, originalPrice, primaryPrice, product.title, rating, reviewCount]);

  return (
    <View style={[styles.card, style]}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={productAccessibilityLabel}
      >
        <View style={styles.imageWrap}>
          {/* `cover`, not `contain`. Catalogue photography arrives at whatever
              ratio the seller uploaded, and letterboxing it left pale bands down
              the sides of any shot that was not already 3:4 — a grid of
              differently-sized pictures reads as broken rather than varied.
              Filling the frame crops instead, so every card is the same shape.
              The detail screen still uses `contain`, where seeing the whole
              garment matters more than a tidy grid. */}
          <Image
            source={firstImage ? { uri: firstImage } : images.productPlaceholder}
            style={styles.image}
            contentFit="cover"
            contentPosition="center"
            transition={100}
            cachePolicy="memory-disk"
            width={imageWidth}
          />

          <View style={styles.imageFooter} pointerEvents="none">
            <View style={styles.ratingPill}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
              <Text style={styles.ratingDivider}>|</Text>
              <Text style={styles.ratingCount}>{reviewCount}</Text>
            </View>

            {discountLabel !== null ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>{discountLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.brand} numberOfLines={1}>
            {(product.category?.name ?? "KTMONA").toUpperCase()}
          </Text>

          <Text style={styles.title} numberOfLines={2}>
            {product.title}
          </Text>

          {typeof primaryPrice === "number" ? (
            <View style={styles.priceBlock}>
              <Text
                style={styles.price}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {currency.format(primaryPrice)}
              </Text>
              {typeof originalPrice === "number" ? (
                <Text
                  style={styles.mrpText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.76}
                >
                  MRP{" "}
                  <Text style={hasDiscount ? styles.priceStrike : undefined}>
                    {currency.format(originalPrice)}
                  </Text>
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.priceUnavailable}>Price on request</Text>
          )}
        </View>
      </Pressable>

      {onTryAndBuy ? (
        <Pressable
          onPress={handleTryAndBuy}
          hitSlop={6}
          style={styles.tryBadge}
          accessibilityRole="button"
          accessibilityLabel={`Virtually try on ${product.title}`}
        >
          <Icon name="sparkles" size={12} color={colors.interactive} />
          <Text style={styles.tryBadgeText}>TRY ON</Text>
        </Pressable>
      ) : null}

      {onRemove ? (
        <Pressable
          onPress={handleRemove}
          disabled={removing}
          hitSlop={8}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${product.title} from wishlist`}
          accessibilityState={{ disabled: removing, busy: removing }}
        >
          {removing ? (
            <ActivityIndicator size="small" color={colors.charcoal} />
          ) : (
            <Icon name="close" size={16} color={colors.charcoal} />
          )}
        </Pressable>
      ) : (
        <Pressable
          onPress={handleToggleWishlist}
          disabled={wishlistBusy}
          hitSlop={8}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={
            wishlisted
              ? `Remove ${product.title} from wishlist`
              : `Add ${product.title} to wishlist`
          }
          accessibilityState={{
            checked: wishlisted,
            disabled: wishlistBusy,
            busy: wishlistBusy,
          }}
        >
          {wishlistBusy ? (
            <ActivityIndicator size="small" color={colors.charcoal} />
          ) : (
            <Icon
              name={wishlisted ? "heart" : "heart-outline"}
              size={16}
              color={wishlisted ? "#E11D48" : colors.charcoal}
            />
          )}
        </Pressable>
      )}

      <View style={styles.ctaRow}>
        <FlowActionButton
          filled
          label="ADD TO BAG"
          icon="cart-outline"
          onPress={() => {
            if (onQuickAdd) onQuickAdd(product.id);
            else handlePress();
          }}
          accessibilityLabel={`Add ${product.title} to bag`}
        />
        <FlowActionButton
          label="BUY NOW"
          icon="card-outline"
          onPress={() => {
            if (onBuyNow) onBuyNow(product.id);
            else handlePress();
          }}
          accessibilityLabel={`Buy ${product.title} now`}
        />
      </View>
    </View>
  );
}

export const MarketplaceCard = React.memo(MarketplaceCardComponent);

const DISCOUNT_AMBER = "#C2410C";
const DISCOUNT_BADGE_BG = "rgba(255, 255, 255, 0.96)";
const RATING_GREEN = "#0F8A5F";

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
    // overflow:hidden is what makes the corner actually clip the photo inside;
    // without it the image squares off the rounding the card just asked for.
    borderRadius: radius.lg,
    overflow: "hidden",
    shadowColor: "#0C1B42",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 4,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  iconButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0C1B42",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  tryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#0C1B42",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  tryBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.charcoal,
    fontWeight: "700",
  },
  imageFooter: {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ratingPill: {
    minHeight: 20,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: RATING_GREEN,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2,
    shadowColor: "#062E21",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  ratingStar: {
    color: "#FFFFFF",
    fontSize: 9,
    lineHeight: 11,
  },
  ratingValue: {
    fontFamily: typography.sansMedium,
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  ratingDivider: {
    fontFamily: typography.sans,
    fontSize: 9,
    color: "rgba(255, 255, 255, 0.72)",
  },
  ratingCount: {
    fontFamily: typography.sans,
    fontSize: 9,
    color: "#FFFFFF",
  },
  discountBadge: {
    borderRadius: radius.pill,
    backgroundColor: DISCOUNT_BADGE_BG,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  discountBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: 9,
    letterSpacing: 0.4,
    color: DISCOUNT_AMBER,
    fontWeight: "700",
  },
  info: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: 0,
    gap: 2,
  },
  brand: {
    fontFamily: typography.serif,
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.charcoal,
    fontWeight: "700",
  },
  title: {
    fontFamily: typography.sans,
    minHeight: 34,
    fontSize: 13,
    color: colors.brownSoft,
    lineHeight: 17,
    marginBottom: 4,
  },
  priceBlock: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  price: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.charcoal,
    fontWeight: "700",
  },
  priceStrike: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textDecorationLine: "line-through",
  },
  mrpText: {
    flexShrink: 1,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
  },
  priceUnavailable: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    minHeight: 24,
  },
  ctaRow: {
    flexDirection: "column",
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
