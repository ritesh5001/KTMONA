import * as React from "react";
import { prefetchProduct } from "../../../src/lib/prefetch-product";
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "../../../src/components/CompatImage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../src/components/Icon";
import { colors, spacing, typography, radius } from "../../../src/theme/tokens";
import { AppHeader } from "../../../src/components/AppHeader";
import { getCategories, type Category } from "../../../src/services/catalog";
import {
  getProducts,
  type ProductItem,
} from "../../../src/services/products";
import { AudienceTabs, type Audience } from "../../../src/components/AudienceTabs";
import { BrandLoader } from "../../../src/components/BrandLoader";
import { MarketplaceCard } from "../../../src/components/MarketplaceCard";
import { QuickBuySheet, type QuickBuyIntent } from "../../../src/components/QuickBuySheet";
import {
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../../src/components";

const COLS = 2;
const ALL_PRODUCTS_PAGE_SIZE = 8;

function mergeUniqueProducts(current: ProductItem[], incoming: ProductItem[]): ProductItem[] {
  if (incoming.length === 0) return current;
  const seen = new Set(current.map((product) => product.id));
  const merged = [...current];

  incoming.forEach((product) => {
    if (!seen.has(product.id)) {
      merged.push(product);
      seen.add(product.id);
    }
  });

  return merged;
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  
  const [audience, setAudience] = React.useState<Audience>("MENS");
  const audienceRef = React.useRef<Audience>("MENS");
  React.useEffect(() => { audienceRef.current = audience; }, [audience]);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | undefined>(
    typeof params.categoryId === "string" ? params.categoryId : undefined
  );
  const selectedCategoryRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => { selectedCategoryRef.current = selectedCategoryId; }, [selectedCategoryId]);
  const [allProducts, setAllProducts] = React.useState<ProductItem[]>([]);
  const [allVisibleCount, setAllVisibleCount] = React.useState(0);
  const [allNextPage, setAllNextPage] = React.useState(2);
  const [isAllPrefetching, setIsAllPrefetching] = React.useState(false);
  const [hasMoreAllProducts, setHasMoreAllProducts] = React.useState(true);
  const [hasAllProductsError, setHasAllProductsError] = React.useState(false);
  const [pendingAllReveal, setPendingAllReveal] = React.useState(false);

  const { data: categoryData, isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
  });

  const categories = React.useMemo<Category[]>(
    () => categoryData?.categories ?? [],
    [categoryData]
  );

  // Fetch all-category products using the same popularity ordering as homepage.
  const {
    data: allProductsData,
    isLoading: allProductsLoading,
    isError: allProductsFailed,
    refetch: refetchAllProducts,
  } = useQuery({
    // Match useProductsQuery's key so Home and Shop share the persisted first
    // page instead of making the shopper wait for the same request twice.
    queryKey: [
      "products",
      {
        page: 1,
        limit: ALL_PRODUCTS_PAGE_SIZE,
        categoryId: selectedCategoryId,
        audience,
        search: undefined,
        sort: "popularity",
      },
    ],
    queryFn: ({ signal }) =>
      getProducts({
        page: 1,
        limit: ALL_PRODUCTS_PAGE_SIZE,
        sort: "popularity",
        audience,
        categoryId: selectedCategoryId,
        signal,
      }),
    staleTime: 1000 * 60 * 5,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    networkMode: "offlineFirst",
  });

  const sidebarWidth = Math.max(72, Math.round(windowWidth * 0.18));
  const contentWidth = windowWidth - sidebarWidth;
  const contentPad = 10;
  const cardGap = 10;
  const cardWidth = Math.floor((contentWidth - contentPad * 2 - cardGap * (COLS - 1)) / COLS);

  const selectedCategory = React.useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const visibleAllProducts = React.useMemo(
    () => allProducts.slice(0, allVisibleCount),
    [allProducts, allVisibleCount]
  );

  const prefetchNextAllProducts = React.useCallback(async () => {
    if (isAllPrefetching || !hasMoreAllProducts) return;

    const requestedAudience = audience;
    const requestedCategoryId = selectedCategoryId;
    setIsAllPrefetching(true);
    setHasAllProductsError(false);

    try {
      const response = await getProducts({
        page: allNextPage,
        limit: ALL_PRODUCTS_PAGE_SIZE,
        sort: "popularity",
        audience: requestedAudience,
        categoryId: requestedCategoryId,
      });

      // Drop the page if the user switched audience or category while it was in flight.
      if (
        audienceRef.current !== requestedAudience ||
        selectedCategoryRef.current !== requestedCategoryId
      ) {
        return;
      }

      const incoming = (response.data ?? []) as ProductItem[];
      const totalPages = response.pagination?.totalPages;

      setAllProducts((previous) => mergeUniqueProducts(previous, incoming));
      setAllNextPage((previous) => previous + 1);
      setHasMoreAllProducts(
        (typeof totalPages === "number"
          ? allNextPage < totalPages
          : incoming.length === ALL_PRODUCTS_PAGE_SIZE) && incoming.length > 0
      );
    } catch {
      if (
        audienceRef.current !== requestedAudience ||
        selectedCategoryRef.current !== requestedCategoryId
      ) {
        return;
      }
      setHasAllProductsError(true);
      setHasMoreAllProducts(false);
    } finally {
      setIsAllPrefetching(false);
    }
  }, [allNextPage, audience, hasMoreAllProducts, isAllPrefetching, selectedCategoryId]);

  const revealNextAllProducts = React.useCallback(() => {
    if (allVisibleCount < allProducts.length) {
      setAllVisibleCount((previous) =>
        Math.min(previous + ALL_PRODUCTS_PAGE_SIZE, allProducts.length)
      );
      return;
    }

    if (hasMoreAllProducts) {
      setPendingAllReveal(true);
      void prefetchNextAllProducts();
    }
  }, [allProducts.length, allVisibleCount, hasMoreAllProducts, prefetchNextAllProducts]);

  React.useEffect(() => {
    const products = ((allProductsData?.data ?? []) as ProductItem[]);
    if (!allProductsData) return;

    const totalPages = allProductsData.pagination?.totalPages;
    setAllProducts(mergeUniqueProducts([], products));
    setAllVisibleCount(Math.min(ALL_PRODUCTS_PAGE_SIZE, products.length));
    setAllNextPage(2);
    setHasMoreAllProducts(
      typeof totalPages === "number" ? totalPages > 1 : products.length === ALL_PRODUCTS_PAGE_SIZE
    );
    setHasAllProductsError(false);
    setPendingAllReveal(false);
  }, [allProductsData]);

  // Keep two batches loaded beyond what is on screen. One batch of headroom
  // meant the reveal at the bottom still had to wait on a request; two means the
  // next batch is already in hand by the time the user scrolls to it.
  React.useEffect(() => {
    if (allProductsLoading) return;
    if (!hasMoreAllProducts || isAllPrefetching) return;
    if (allProducts.length - allVisibleCount >= ALL_PRODUCTS_PAGE_SIZE * 2) return;

    void prefetchNextAllProducts();
  }, [
    allProducts.length,
    allProductsLoading,
    allVisibleCount,
    hasMoreAllProducts,
    isAllPrefetching,
    prefetchNextAllProducts,
  ]);

  React.useEffect(() => {
    if (!pendingAllReveal) return;

    if (allVisibleCount < allProducts.length) {
      setAllVisibleCount((previous) =>
        Math.min(previous + ALL_PRODUCTS_PAGE_SIZE, allProducts.length)
      );
      setPendingAllReveal(false);
      return;
    }

    if (!hasMoreAllProducts && !isAllPrefetching) {
      setPendingAllReveal(false);
    }
  }, [
    allProducts.length,
    allVisibleCount,
    hasMoreAllProducts,
    isAllPrefetching,
    pendingAllReveal,
  ]);

  const handleProductPress = React.useCallback(
    (product: ProductItem) => {
      prefetchProduct(queryClient, product.id);
      router.push({
        pathname: "/product/[id]",
        params: { id: product.id, ...(product.categoryId ? { categoryId: product.categoryId } : {}) },
      });
    },
    [queryClient, router]
  );

  const handleTryAndBuy = React.useCallback(
    (productId: string) => {
      router.push({ pathname: "/(tabs)/try-buy", params: { productId } });
    },
    [router]
  );

  const handleCategorySelect = React.useCallback((categoryId: string | undefined) => {
    setSelectedCategoryId(categoryId);
  }, []);

  const renderCategoryItem = React.useCallback(
    ({ item }: { item: Category }) => {
      const isActive = selectedCategoryId === item.id;
      return (
        <Pressable
          style={[styles.categoryItem, isActive && styles.categoryItemActive]}
          onPress={() => handleCategorySelect(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Shop ${item.name}`}
          accessibilityState={{ selected: isActive }}
        >
          {item.image && (
            <Image
              source={{ uri: item.image }}
              style={styles.categoryImage}
              contentFit="cover"
            />
          )}
          <Text
            style={[styles.categoryName, isActive && styles.categoryNameActive]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [selectedCategoryId, handleCategorySelect]
  );

  // Quick buy: open a size sheet over the list instead of pushing the product page.
  const [quickBuyId, setQuickBuyId] = React.useState<string | null>(null);
  const [quickBuyIntent, setQuickBuyIntent] = React.useState<QuickBuyIntent>("cart");

  const openQuickAdd = React.useCallback((productId: string) => {
    setQuickBuyIntent("cart");
    setQuickBuyId(productId);
  }, []);

  const openBuyNow = React.useCallback((productId: string) => {
    setQuickBuyIntent("buy");
    setQuickBuyId(productId);
  }, []);

  // Both the style object and the press handler have to be stable, or the
  // React.memo on MarketplaceCard never holds: an inline `{ width }` and an
  // inline `() => handleProductPress(item)` are new values on every render, so
  // every visible card re-rendered whenever anything on this screen changed.
  const cardStyle = React.useMemo(() => ({ width: cardWidth }), [cardWidth]);

  // The card hands back an id, so the record is looked up rather than captured
  // in a per-item closure.
  const productsById = React.useMemo(() => {
    const map = new Map<string, ProductItem>();
    for (const item of allProducts) map.set(item.id, item);
    return map;
  }, [allProducts]);

  const handleCardPress = React.useCallback(
    (id: string) => {
      const product = productsById.get(id);
      if (product) handleProductPress(product);
    },
    [productsById, handleProductPress]
  );

  const renderProductCard = React.useCallback(
    ({ item }: { item: ProductItem }) => (
      <MarketplaceCard
        product={item}
        onPress={handleCardPress}
        onTryAndBuy={handleTryAndBuy}
        onQuickAdd={openQuickAdd}
        onBuyNow={openBuyNow}
        style={cardStyle}
        imageWidth={cardWidth}
      />
    ),
    [cardStyle, cardWidth, handleCardPress, handleTryAndBuy, openQuickAdd, openBuyNow]
  );

  const productListHeader = React.useMemo(
    () =>
      selectedCategory ? (
        <View style={styles.categoryHeader}>
          <View style={styles.categoryHeaderRow}>
            <View style={styles.categoryHeaderMark} />
            <Text style={styles.categoryHeaderEyebrow}>Shopping</Text>
          </View>
          <Text style={styles.categoryHeaderTitle}>{selectedCategory.name}</Text>
          <Text style={styles.categoryHeaderMeta}>
            {allProductsLoading
              ? "Loading…"
              : `${allProducts.length}${hasMoreAllProducts ? "+" : ""} ${allProducts.length === 1 ? "piece" : "pieces"} curated for you`}
          </Text>
        </View>
      ) : (
        <Text style={styles.sectionTitle}>All Products</Text>
      ),
    [allProducts.length, allProductsLoading, hasMoreAllProducts, selectedCategory]
  );

  const productListEmpty = React.useMemo(() => {
    if (allProductsLoading) {
      return (
        <View style={styles.loadingWrap}>
          <BrandLoader size="sm" color={colors.gold} />
        </View>
      );
    }
    if (allProductsFailed) {
      return (
        <View style={styles.emptyState}>
          <Icon name="alert-circle-outline" size={24} color={colors.brownSoft} />
          <Text style={styles.emptyTitle}>We couldn&apos;t load the shop</Text>
          <Text style={styles.emptyText}>Check your connection and try again.</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void refetchAllProducts()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading products"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <Text style={styles.emptyText}>
        {selectedCategoryId
          ? "No products in this category"
          : "No products available right now"}
      </Text>
    );
  }, [
    allProductsFailed,
    allProductsLoading,
    refetchAllProducts,
    selectedCategoryId,
  ]);

  const productListFooter = React.useMemo(() => {
    if (hasAllProductsError) {
      return <Text style={styles.statusText}>Could not load more products right now.</Text>;
    }
    if (hasMoreAllProducts || allVisibleCount < allProducts.length) {
      return (
        <View style={styles.loadingWrap}>
          <BrandLoader size="sm" color={colors.gold} />
        </View>
      );
    }
    return visibleAllProducts.length > 0 ? (
      <Text style={styles.statusText}>You have reached the end.</Text>
    ) : null;
  }, [
    allProducts.length,
    allVisibleCount,
    hasAllProductsError,
    hasMoreAllProducts,
    visibleAllProducts.length,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader variant="main" />

      <View style={styles.audienceBar}>
        <AudienceTabs value={audience} onChange={setAudience} />
      </View>

      <View style={styles.container}>
        {/* Left Sidebar - Categories */}
        <View style={[styles.sidebar, { width: sidebarWidth }]}>
          {categoriesLoading ? (
            <View style={styles.sidebarLoading}>
              <BrandLoader size="sm" color={colors.gold} />
            </View>
          ) : (
            <>
              {/* All Categories option */}
              <Pressable
                style={[
                  styles.categoryItem,
                  !selectedCategoryId && styles.categoryItemActive,
                ]}
                onPress={() => handleCategorySelect(undefined)}
                accessibilityRole="button"
                accessibilityLabel="Shop all categories"
                accessibilityState={{ selected: !selectedCategoryId }}
              >
                <View style={styles.categoryImagePlaceholder}>
                  <Icon name="grid" size={24} color={colors.charcoal} />
                </View>
                <Text
                  style={[
                    styles.categoryName,
                    !selectedCategoryId && styles.categoryNameActive,
                  ]}
                  numberOfLines={2}
                >
                  All Categories
                </Text>
              </Pressable>

              <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                renderItem={renderCategoryItem}
                scrollEnabled
                showsVerticalScrollIndicator={false}
              />
            </>
          )}
        </View>

        {/* Right Content Area */}
        <FlatList
          style={[styles.contentArea, { width: contentWidth }]}
          data={visibleAllProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProductCard}
          numColumns={COLS}
          ListHeaderComponent={productListHeader}
          ListEmptyComponent={productListEmpty}
          ListFooterComponent={productListFooter}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.productListContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={40}
          windowSize={5}
          removeClippedSubviews
          onEndReached={revealNextAllProducts}
          onEndReachedThreshold={1.25}
        />
      </View>
      <QuickBuySheet
        productId={quickBuyId}
        intent={quickBuyIntent}
        visible={Boolean(quickBuyId)}
        onClose={() => setQuickBuyId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  audienceBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.background,
    alignItems: "center",
  },
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.background,
  },
  sidebar: {
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
    backgroundColor: colors.background,
    paddingHorizontal: 0,
    paddingTop: 6,
  },
  sidebarLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryItem: {
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderLeftWidth: 2,
    borderLeftColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  categoryItemActive: {
    borderLeftColor: colors.gold,
    backgroundColor: colors.cream,
  },
  categoryImage: {
    width: 44,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  categoryImagePlaceholder: {
    width: 44,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.charcoal,
    textAlign: "center",
    marginTop: 5,
    flexShrink: 1,
    paddingHorizontal: 2,
  },
  categoryNameActive: {
    fontFamily: typography.sansMedium,
    color: colors.gold,
    fontWeight: "700",
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  productListContent: {
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.charcoal,
    marginBottom: 12,
    fontWeight: "700",
  },
  categoryHeader: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  categoryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  categoryHeaderMark: {
    width: 18,
    height: 1.5,
    backgroundColor: colors.gold,
  },
  categoryHeaderEyebrow: {
    fontFamily: typography.sansMedium,
    fontSize: 9.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.gold,
    fontWeight: "700",
  },
  categoryHeaderTitle: {
    fontFamily: typography.serif,
    fontSize: 22,
    color: colors.charcoal,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  categoryHeaderMeta: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    marginTop: 2,
  },
  productRow: {
    gap: 10,
    marginBottom: 10,
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    marginTop: spacing.sm,
    fontFamily: typography.serif,
    fontSize: 20,
    color: colors.charcoal,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 44,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.charcoal,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.background,
  },
  statusText: {
    marginTop: spacing.md,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textAlign: "center",
    letterSpacing: 0.4,
  },
});
