import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchProduct } from "../../../src/lib/prefetch-product";
import {
  View,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  type ListRenderItemInfo,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, typography, radius } from "../../../src/theme/tokens";
import { useWishlist } from "../../../src/providers/WishlistProvider";
import { useAuth } from "../../../src/hooks/useAuth";
import { type WishlistItemDetail } from "../../../src/services/wishlist";
import { type ProductItem } from "../../../src/services/products";
import { AnimatedPressable } from "../../../src/components/AnimatedPressable";
import { impactLight } from "../../../src/utils/haptics";
import { AppHeader } from "../../../src/components/AppHeader";
import { BrandLoader } from "../../../src/components/BrandLoader";
import { WishlistIcon } from "../../../src/components/WishlistIcon";
import { MarketplaceCard } from "../../../src/components/MarketplaceCard";
import { QuickBuySheet, type QuickBuyIntent } from "../../../src/components/QuickBuySheet";
import { MotionView } from "../../../src/components/motion";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../../src/components";

// ---------------------------------------------------------------------------
// Wishlist card — uses shared MarketplaceCard with remove overlay
// ---------------------------------------------------------------------------

const WishlistCard = React.memo(function WishlistCard({
  item,
  onRemove,
  onPress,
  onQuickAdd,
  onBuyNow,
  removing,
  width,
}: {
  item: WishlistItemDetail;
  onRemove: (productId: string) => void;
  onPress: (productId: string) => void;
  onQuickAdd: (productId: string) => void;
  onBuyNow: (productId: string) => void;
  removing: boolean;
  width: number;
}) {
  const adminPrice =
    item.product.adminPrice ??
    item.product.adminListingPrice ??
    item.product.salePrice ??
    item.product.price ??
    null;
  const product: ProductItem = {
    id: item.productId,
    title: item.product.title,
    images: item.product.images,
    category: item.product.category ?? null,
    price: item.product.price ?? adminPrice,
    adminPrice,
    salePrice: item.product.salePrice ?? adminPrice,
    regularPrice: item.product.regularPrice ?? null,
  };

  return (
    <MarketplaceCard
      product={product}
      onPress={onPress}
      onQuickAdd={onQuickAdd}
      onBuyNow={onBuyNow}
      onRemove={(id) => {
        impactLight();
        onRemove(id);
      }}
      removing={removing}
      style={{ width }}
      imageWidth={width}
    />
  );
});

/** Hoisted so the list sees one stable component type, not a new one each render. */
const WishlistSeparator = () => <View style={styles.separator} />;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function WishlistScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: viewportWidth } = useWindowDimensions();
  const columnCount = viewportWidth >= 900 ? 4 : viewportWidth >= 600 ? 3 : 2;
  const cardWidth = Math.max(
    148,
    (viewportWidth - spacing.lg * 2 - spacing.md * (columnCount - 1)) / columnCount
  );
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.accessToken ?? null;
  const [quickBuyId, setQuickBuyId] = React.useState<string | null>(null);
  const [quickBuyIntent, setQuickBuyIntent] = React.useState<QuickBuyIntent>("cart");
  const {
    wishlistItems,
    isLoading,
    removeFromWishlist,
    mutatingIds,
    refreshWishlist,
    fetchError,
  } = useWishlist();

  const handlePress = React.useCallback(
    (productId: string) => {
      prefetchProduct(queryClient, productId);
      router.push(`/product/${productId}`);
    },
    [queryClient, router]
  );

  const handleRemove = React.useCallback(
    (productId: string) => {
      removeFromWishlist(productId);
    },
    [removeFromWishlist]
  );

  const openQuickAdd = React.useCallback((productId: string) => {
    setQuickBuyIntent("cart");
    setQuickBuyId(productId);
  }, []);

  const openBuyNow = React.useCallback((productId: string) => {
    setQuickBuyIntent("buy");
    setQuickBuyId(productId);
  }, []);

  // Fade, not slide: a slide leaves the card off-screen until the animation
  // completes, and a recycled cell never completes it.
  const renderItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<WishlistItemDetail>) => (
      <MotionView preset="fade" delay={Math.min(index * 30, 180)}>
        <WishlistCard
          item={item}
          onRemove={handleRemove}
          onPress={handlePress}
          onQuickAdd={openQuickAdd}
          onBuyNow={openBuyNow}
          removing={mutatingIds.has(item.productId)}
          width={cardWidth}
        />
      </MotionView>
    ),
    [cardWidth, handleRemove, handlePress, mutatingIds, openBuyNow, openQuickAdd]
  );

  const keyExtractor = React.useCallback(
    (item: WishlistItemDetail) => item.id,
    []
  );

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <AppHeader title="Wishlist" subtitle="Saved styles" showBack />
        <View style={styles.emptyWrap}>
          <BrandLoader label="Loading wishlist" color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <AppHeader title="Wishlist" subtitle="Saved styles" showBack />
        <View style={styles.emptyWrap}>
          <WishlistIcon size={48} color={colors.brownSoft} />
          <Text style={styles.emptyTitle}>Sign in to use wishlist</Text>
          <Text style={styles.emptySubtitle}>
            Save favorites and keep them synced to your account.
          </Text>
          <AnimatedPressable
            onPress={() => router.push("/login?returnTo=%2Fwishlist")}
            style={styles.ctaButton}
            accessibilityRole="button"
            accessibilityLabel="Sign in to use wishlist"
          >
            <Text style={styles.ctaButtonText}>Sign in</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => router.push("/search")}
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel="Continue browsing products"
          >
            <Text style={styles.secondaryButtonText}>Continue browsing</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader
        title="Wishlist"
        subtitle={`${wishlistItems.length} ${wishlistItems.length === 1 ? "item" : "items"} saved`}
        showBack
      />

      {isLoading ? (
        <View style={styles.emptyWrap}>
          <BrandLoader label="Loading wishlist" color={colors.gold} />
        </View>
      ) : fetchError ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Unable to load wishlist</Text>
          <AnimatedPressable
            onPress={refreshWishlist}
            style={styles.ctaButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading wishlist"
          >
            <Text style={styles.ctaButtonText}>Retry</Text>
          </AnimatedPressable>
        </View>
      ) : wishlistItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <WishlistIcon size={48} color={colors.brownSoft} />
          <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse our collections and tap the heart to save items you love.
          </Text>
          <AnimatedPressable
            onPress={() => router.push("/search")}
            style={styles.ctaButton}
            accessibilityRole="button"
            accessibilityLabel="Explore shop"
          >
            <Text style={styles.ctaButtonText}>Explore Shop</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          key={`wishlist-grid-${columnCount}`}
          data={wishlistItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={columnCount}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // No removeClippedSubviews: these cells carry a reanimated entering
          // animation, and detaching a view mid-animation is a native crash on
          // Android. The saving was never worth it for a two-column grid.
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          ItemSeparatorComponent={WishlistSeparator}
        />
      )}
      <QuickBuySheet
        productId={quickBuyId}
        intent={quickBuyIntent}
        visible={Boolean(quickBuyId)}
        onClose={() => setQuickBuyId(null)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  columnWrapper: {
    gap: spacing.md,
  },
  separator: {
    height: spacing.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: 16,
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 20,
    color: colors.charcoal,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: typography.sans,
    fontSize: 14,
    color: colors.brownSoft,
    textAlign: "center",
    lineHeight: 22,
  },
  ctaButton: {
    marginTop: 8,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  ctaButtonText: {
    fontFamily: typography.sans,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.background,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  secondaryButtonText: {
    fontFamily: typography.sans,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.foreground,
  },
});
