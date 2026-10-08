import * as React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { colors, spacing, typography, shadow, radius } from "../../../src/theme/tokens";
import { useAuth } from "../../../src/hooks/useAuth";
import { useCart } from "@/src/providers/CartProvider";
import { useNetworkStatus } from "../../../src/hooks/useNetworkStatus";
import { useToast } from "../../../src/providers/ToastProvider";
import { SkeletonCartRow } from "../../../src/components/Skeleton";
import { AnimatedPressable } from "../../../src/components/AnimatedPressable";
import { impactLight } from "../../../src/utils/haptics";
import type { CartItemDetails } from "../../../src/services/cart";
import { AppHeader } from "../../../src/components/AppHeader";
import { Icon } from "../../../src/components/Icon";
import { Image } from "../../../src/components/CompatImage";
import { MotionView } from "../../../src/components/motion";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../../src/components";
import { getShippingConfig, getGstConfig } from "../../../src/services/shipping";

/** Thumbnail is 96dp square; ask the CDN for that rather than the original. */
const CART_THUMB_WIDTH = 96;

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function CartScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.accessToken ?? null;
  const { isConnected } = useNetworkStatus();
  const { showToast } = useToast();
  const {
    cartItems,
    isLoading,
    isMutating,
    mutatingIds,
    updateQuantity,
    removeFromCart,
    refreshCart,
    fetchError,
  } = useCart();

  const handleQty = React.useCallback(
    (itemId: string, nextQty: number) => {
      if (!isConnected) {
        showToast("You're offline. Please check your connection.", "error");
        return;
      }
      impactLight();
      updateQuantity(itemId, nextQty);
    },
    [isConnected, updateQuantity, showToast]
  );

  const handleRemove = React.useCallback(
    (itemId: string) => {
      if (!isConnected) {
        showToast("You're offline. Please check your connection.", "error");
        return;
      }
      removeFromCart(itemId);
    },
    [isConnected, removeFromCart, showToast]
  );

  const handleCheckout = React.useCallback(() => {
    if (!isConnected) {
      showToast("You're offline. Please check your connection.", "error");
      return;
    }
    if (isMutating) {
      showToast("Cart is updating. Please wait.", "info");
      return;
    }
    if (cartItems.length === 0) return;
    router.push("/checkout");
  }, [isConnected, isMutating, cartItems.length, router, showToast]);

  // Admin-controlled shipping / GST charges. Default to the flat fees until
  // resolved; the backend order total is always the source of truth.
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
    let active = true;
    getShippingConfig(controller.signal)
      .then((config) => {
        if (active) setShippingConfig(config);
      })
      .catch(() => {
        /* Non-fatal: keep the default estimate. */
      });
    getGstConfig(controller.signal)
      .then((config) => {
        if (active) setGstConfig(config);
      })
      .catch(() => {
        /* Non-fatal: keep the default estimate. */
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.priceSnapshot * item.quantity,
    0
  );
  const shipping =
    cartItems.length && shippingConfig.enabled ? shippingConfig.amount : 0;
  const gst = cartItems.length && gstConfig.enabled ? gstConfig.amount : 0;
  const total = subtotal + shipping + gst;

  // The store prepends new items, so index 0 is the one that just arrived. The
  // gold wash fades out on its own — a marker, not a permanent state.
  const [isFreshArrival, setIsFreshArrival] = React.useState(true);
  React.useEffect(() => {
    const timer = setTimeout(() => setIsFreshArrival(false), 1400);
    return () => clearTimeout(timer);
  }, []);

  const renderItem = React.useCallback(
    ({ item, index }: { item: CartItemDetails; index: number }) => {
      const locked = mutatingIds.has(item.id);
      // Prefer the variant's own colour gallery so the thumbnail matches the
      // colour actually being bought, not just the product's first image.
      const thumbnail =
        item.variant?.images?.[0] ?? item.product?.images?.[0] ?? null;
      const compareAt = item.variant?.compareAtPrice;
      const hasDiscount =
        typeof compareAt === "number" && compareAt > item.priceSnapshot;
      const discountPercent = hasDiscount
        ? Math.round(((compareAt - item.priceSnapshot) / compareAt) * 100)
        : 0;
      const lineTotal = item.priceSnapshot * item.quantity;
      const stock = item.variant?.inventory?.stock;

      return (
        // Fade, not slide. SlideInUp starts the row off-screen, and a row that is
        // recycled or clipped mid-animation never travels back — which is how
        // cart rows ended up invisible. A fade has no off-screen start state to
        // get stranded in.
        <MotionView preset="fade" delay={Math.min(index * 40, 200)}>
          <View style={[styles.itemCard, index === 0 && isFreshArrival && styles.itemCardArrived]}>
            <View style={styles.itemRow}>
              {thumbnail ? (
                <Image
                  source={{ uri: thumbnail }}
                  style={styles.itemImage}
                  contentFit="cover"
                  transition={150}
                  width={CART_THUMB_WIDTH}
                />
              ) : (
                <View style={[styles.itemImage, styles.itemImageFallback]}>
                  <Text style={styles.itemImageFallbackText}>
                    {(item.product?.title ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.product?.title ?? "Item"}
                </Text>

                <View style={styles.itemMetaRow}>
                  {item.variant?.colorHex ? (
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: item.variant.colorHex },
                      ]}
                    />
                  ) : null}
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {item.variant?.color ? `${item.variant.color} · ` : ""}
                    Size {item.variant?.size ?? "Default"}
                  </Text>
                </View>

                {item.variant?.sku ? (
                  <Text style={styles.itemSku} numberOfLines={1}>
                    SKU {item.variant.sku}
                  </Text>
                ) : null}

                <View style={styles.priceRow}>
                  <Text style={styles.itemPrice}>
                    {currency.format(item.priceSnapshot)}
                  </Text>
                  {hasDiscount ? (
                    <>
                      <Text style={styles.itemCompareAt}>
                        {currency.format(compareAt as number)}
                      </Text>
                      <Text style={styles.itemDiscount}>{discountPercent}% off</Text>
                    </>
                  ) : null}
                </View>

                {/* Always shown, not only above one unit: the line total is what
                    the shopper is actually being charged for this row. */}
                <Text style={styles.lineTotal}>
                  {item.quantity} × {currency.format(item.priceSnapshot)} ={" "}
                  <Text style={styles.lineTotalValue}>
                    {currency.format(lineTotal)}
                  </Text>
                </Text>

                {typeof stock === "number" && stock > 0 && stock <= 5 ? (
                  <Text style={styles.stockWarning}>Only {stock} left</Text>
                ) : null}
              </View>

              <Pressable
                style={styles.removeIcon}
                onPress={() => handleRemove(item.id)}
                disabled={locked}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.product?.title ?? "item"} from cart`}
                accessibilityState={{ disabled: locked }}
              >
                <Text style={[styles.removeIconText, locked && { opacity: 0.4 }]}>
                  ×
                </Text>
              </Pressable>
            </View>

            <View style={styles.itemFooter}>
              <View style={styles.qtyRow}>
                <Pressable
                  style={[styles.qtyButton, locked && styles.qtyButtonDisabled]}
                  onPress={() => handleQty(item.id, item.quantity - 1)}
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease quantity of ${item.product?.title ?? "item"}`}
                  accessibilityState={{ disabled: locked }}
                >
                  <Text style={styles.qtyButtonText}>−</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{item.quantity}</Text>
                <Pressable
                  style={[styles.qtyButton, locked && styles.qtyButtonDisabled]}
                  onPress={() => handleQty(item.id, item.quantity + 1)}
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase quantity of ${item.product?.title ?? "item"}`}
                  accessibilityState={{ disabled: locked }}
                >
                  <Text style={styles.qtyButtonText}>+</Text>
                </Pressable>
              </View>
              {locked ? <Text style={styles.updatingText}>Updating…</Text> : null}
            </View>
          </View>
        </MotionView>
      );
    },
    [mutatingIds, handleQty, handleRemove, isFreshArrival]
  );

  const keyExtractor = React.useCallback(
    (item: CartItemDetails) => item.id,
    []
  );

  const showSkeleton = (isLoading || authLoading) && cartItems.length === 0;

  if (!authLoading && !token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Cart" subtitle="Review your items" showBack showWishlist />
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Icon name="cart-outline" size={36} color={colors.brownSoft} />
          </View>
          <Text style={styles.emptyTitle}>Sign in to view your cart</Text>
          <Text style={styles.emptySubtitle}>
            Access your saved bag and continue securely to checkout.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push("/login?returnTo=%2Fcart")}
            accessibilityRole="button"
            accessibilityLabel="Sign in to view your cart"
          >
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push("/search")}
            accessibilityRole="button"
            accessibilityLabel="Continue shopping"
          >
            <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title="Cart" subtitle="Review your items" showBack showWishlist />

      {showSkeleton ? (
        <View style={styles.listContent}>
          <SkeletonCartRow />
          <SkeletonCartRow />
          <SkeletonCartRow />
        </View>
      ) : fetchError && cartItems.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{fetchError}</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={refreshCart}
            accessibilityRole="button"
            accessibilityLabel="Retry loading cart"
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : cartItems.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Icon name="cart-outline" size={36} color={colors.brownSoft} />
          </View>
          <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Discover our premium collection and add something beautiful.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push("/search")}
            accessibilityRole="button"
            accessibilityLabel="Continue shopping"
          >
            <Text style={styles.primaryButtonText}>Continue Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            // Without an explicit flex the list sized itself to its content and
            // the summary below claimed the rest of the screen. On a one-item
            // cart that pushed the rows out of view entirely — the "images are
            // not showing" was the whole row being invisible, not the image.
            style={styles.list}
            contentContainerStyle={styles.listContent}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={7}
            showsVerticalScrollIndicator={false}
          />

          <View style={[styles.summaryFooter, { paddingBottom: tabBarHeight }]}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                {currency.format(subtotal)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text
                style={[
                  styles.summaryValue,
                  shipping === 0 ? { color: colors.gold } : null,
                ]}
              >
                {shipping === 0 ? "FREE" : currency.format(shipping)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GST</Text>
              <Text
                style={[
                  styles.summaryValue,
                  gst === 0 ? { color: colors.gold } : null,
                ]}
              >
                {gst === 0 ? "FREE" : currency.format(gst)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotal}>Total</Text>
              <Text style={styles.summaryTotal}>
                {currency.format(total)}
              </Text>
            </View>
            <AnimatedPressable
              style={[
                styles.primaryButton,
                (isMutating || cartItems.length === 0 || !isConnected) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleCheckout}
              disabled={isMutating || cartItems.length === 0 || !isConnected}
              accessibilityRole="button"
              accessibilityLabel="Proceed to checkout"
              accessibilityState={{
                disabled: isMutating || cartItems.length === 0 || !isConnected,
                busy: isMutating,
              }}
            >
              <Text style={styles.primaryButtonText}>
                {!isConnected
                  ? "Offline"
                  : isMutating
                    ? "Updating cart\u2026"
                    : "Proceed to checkout"}
              </Text>
            </AnimatedPressable>
          </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  /** Takes the space between the header and the pinned summary. */
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  /** Fades away via isFreshArrival; marks the row that just flew in. */
  itemCardArrived: {
    borderColor: colors.gold,
    backgroundColor: colors.cream,
  },
  itemCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  itemRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  itemImage: {
    width: 96,
    height: 120,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  itemImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemImageFallbackText: {
    fontFamily: typography.serif,
    fontSize: 28,
    color: colors.brownSoft,
  },
  itemInfo: {
    flex: 1,
    justifyContent: "center",
  },
  itemTitle: {
    fontFamily: typography.serif,
    fontSize: 16,
    lineHeight: 22,
    color: colors.charcoal,
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  itemMeta: {
    flex: 1,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  itemPrice: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.charcoal,
  },
  itemCompareAt: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textDecorationLine: "line-through",
  },
  itemSku: {
    marginTop: 4,
    fontFamily: typography.sans,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.brownSoft,
  },
  itemDiscount: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.gold,
  },
  lineTotal: {
    marginTop: 4,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
  },
  lineTotalValue: {
    fontFamily: typography.sansMedium,
    color: colors.charcoal,
  },
  stockWarning: {
    marginTop: 4,
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: "#B4553F",
  },
  removeIcon: {
    paddingHorizontal: spacing.xs,
  },
  removeIconText: {
    fontFamily: typography.sans,
    fontSize: 20,
    lineHeight: 22,
    color: colors.brownSoft,
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  updatingText: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.gold,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  qtyButton: {
    borderRadius: radius.md,
    height: 34,
    width: 34,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButtonDisabled: {
    opacity: 0.35,
  },
  qtyButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 18,
    color: colors.charcoal,
  },
  qtyValue: {
    minWidth: 24,
    textAlign: "center",
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.charcoal,
  },
  // Pinned above the tab bar so Proceed to checkout is always reachable. The
  // upward shadow is what tells the eye the list continues underneath it.
  summaryFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.background,
    shadowColor: colors.charcoal,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 10,
    elevation: 12,
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    ...shadow.card,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },
  summaryValue: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.charcoal,
  },
  summaryTotal: {
    fontFamily: typography.serif,
    fontSize: 20,
    color: colors.charcoal,
  },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    // The label was hugging the edges: give it real breathing room and a
    // comfortable tap target.
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    // Full width rather than centred. A checkout button is the page's single
    // most important target, and `alignSelf: center` here also fought the
    // wrapper's sizing rules.
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
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
  secondaryButton: {
    marginTop: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.foreground,
  },
  emptyCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    ...shadow.card,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 18,
    color: colors.charcoal,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.md,
  },
});
