import React from "react";
import { prefetchProduct } from "../../../src/lib/prefetch-product";
import {
  FlatList,
  ListRenderItemInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextStyle,
  useWindowDimensions,
} from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useRouter } from "expo-router";
import { SectionMark } from "../../../src/components/SectionMark";
import { colors, spacing, textStyles, typography, radius } from "../../../src/theme";
import { useProductsQuery } from "../../../src/hooks/useProductsQuery";
import { AppHeader } from "../../../src/components/AppHeader";
import { Footer } from "../../../src/components/Footer";
import { ScrollToTopFab } from "../../../src/components/ScrollToTopFab";
import { CachedImage } from "../../../src/components/CachedImage";
import { SkeletonBlock } from "../../../src/components/Skeleton";
import { images } from "../../../src/data/images";
import { AppText as Text, HomeHeroBanner, ScreenContainer as SafeAreaView } from "../../../src/components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCategories,
  getOccasions,
  type Category,
  type Occasion,
} from "../../../src/services/catalog";
import {
  getBestsellers,
  type BestsellerProduct,
} from "../../../src/services/bestsellers";
import { getProducts, type ProductItem } from "../../../src/services/products";
import { MarketplaceCard } from "../../../src/components/MarketplaceCard";
import { QuickBuySheet, type QuickBuyIntent } from "../../../src/components/QuickBuySheet";
import { AudienceTabs, type Audience } from "../../../src/components/AudienceTabs";

const MOST_LOVED_PAGE_SIZE = 8;
const HOME_SECTION_TITLE: TextStyle = {
  ...textStyles.sectionTitle,
  fontSize: 22,
  lineHeight: 28,
  letterSpacing: 1.8,
  textTransform: "uppercase",
};

type HomeGridCard = {
  id: string;
  title: string;
  image: string;
  query: string;
};

type HomeGridPage = {
  id: string;
  items: HomeGridCard[];
};

type HomeProductCard = {
  id: string;
  title: string;
  image: string;
  priceText: string;
  categoryText?: string;
  query: string;
  product: ProductItem;
};

function BottomWineFade() {
  return (
    <View pointerEvents="none" style={styles.bottomWineFade}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <SvgLinearGradient id="tv-wine-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#0C1B42" stopOpacity="0" />
            <Stop offset="52%" stopColor="#0C1B42" stopOpacity="0.06" />
            <Stop offset="76%" stopColor="#0C1B42" stopOpacity="0.28" />
            <Stop offset="100%" stopColor="#0C1B42" stopOpacity="0.72" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tv-wine-fade)" />
      </Svg>
    </View>
  );
}

function ArchGradientBorder({
  width,
  height,
  topRadius,
  strokeWidth = 3.1,
}: {
  width: number;
  height: number;
  topRadius: number;
  strokeWidth?: number;
}) {

  const inset = strokeWidth / 2;
  const radius = Math.max(1, Math.min(topRadius, (width - strokeWidth) / 2));
  const leftX = inset;
  const rightX = width - inset;
  const bottomY = height - inset;
  const arcY = inset + radius;
  const gradientId = `tv-arch-border-${Math.round(width)}-${Math.round(height)}-${Math.round(radius)}`;

  return (
    <View pointerEvents="none" style={styles.archGradientBorderWrap}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#DDE5F4" stopOpacity="1" />
            <Stop offset="40%" stopColor="#5A6FA8" stopOpacity="1" />
            <Stop offset="100%" stopColor="#0C1B42" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Path
          d={`M ${leftX} ${bottomY} L ${leftX} ${arcY} A ${radius} ${radius} 0 0 1 ${rightX} ${arcY} L ${rightX} ${bottomY} L ${leftX} ${bottomY}`}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
}

function RectGradientBorder({
  width,
  height,
  strokeWidth = 3.1,
}: {
  width: number;
  height: number;
  strokeWidth?: number;
}) {
  const inset = strokeWidth / 2;
  const gradientId = `tv-rect-border-${Math.round(width)}-${Math.round(height)}-${Math.round(strokeWidth * 10)}`;

  return (
    <View pointerEvents="none" style={styles.archGradientBorderWrap}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#DDE5F4" stopOpacity="1" />
            <Stop offset="40%" stopColor="#5A6FA8" stopOpacity="1" />
            <Stop offset="100%" stopColor="#0C1B42" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Rect
          x={inset}
          y={inset}
          width={Math.max(0, width - strokeWidth)}
          height={Math.max(0, height - strokeWidth)}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
}

function chunkCards(cards: HomeGridCard[], size: number): HomeGridPage[] {
  const pages: HomeGridPage[] = [];
  for (let i = 0; i < cards.length; i += size) {
    const slice = cards.slice(i, i + size);
    pages.push({ id: `page-${i / size + 1}`, items: slice });
  }
  return pages;
}

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

/** Hoisted: a stable component type, so separators are not remounted each render. */
const OccasionSeparator = () => <View style={{ width: spacing.md }} />;

function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.gridEmptyState} accessibilityRole="alert">
      <Text style={styles.gridErrorText}>{message}</Text>
      <Pressable
        style={styles.sectionRetryButton}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={`Retry ${message.toLowerCase()}`}
      >
        <Text style={styles.sectionRetryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  // Catalog data barely changes and the API caches it for 30 minutes, so the old
  // 1-minute staleTime meant the home screen refetched — and flashed a loader —
  // almost every time the app was reopened. 10 minutes matches the global default,
  // so the persisted cache paints instantly on launch instead.
  const categoriesQuery = useQuery({
    queryKey: ["home-categories"],
    queryFn: getCategories,
    staleTime: 10 * 60 * 1000,
  });
  const occasionsQuery = useQuery({
    queryKey: ["home-occasions"],
    queryFn: getOccasions,
    staleTime: 10 * 60 * 1000,
  });
  const [bestsellersAudience, setBestsellersAudience] = React.useState<Audience>("MENS");
  const [mostLovedAudience, setMostLovedAudience] = React.useState<Audience>("MENS");

  const bestsellersQuery = useQuery({
    queryKey: ["home-bestsellers", bestsellersAudience],
    queryFn: () => getBestsellers(4, bestsellersAudience),
    staleTime: 10 * 60 * 1000,
  });
  const mostLovedQuery = useProductsQuery({
    page: 1,
    limit: MOST_LOVED_PAGE_SIZE,
    sort: "popularity",
    audience: mostLovedAudience,
  });
  const refetchCategories = categoriesQuery.refetch;
  const refetchOccasions = occasionsQuery.refetch;
  const refetchBestsellers = bestsellersQuery.refetch;
  const refetchMostLoved = mostLovedQuery.refetch;

  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const listRef = React.useRef<FlatList<{ key: string; node: React.ReactNode }> | null>(null);
  const [occasionPageIndex, setOccasionPageIndex] = React.useState(0);
  const [categoryPageIndex, setCategoryPageIndex] = React.useState(0);
  const [bestsellerPageIndex, setBestsellerPageIndex] = React.useState(0);
  const [mostLovedProducts, setMostLovedProducts] = React.useState<ProductItem[]>([]);
  const [mostLovedVisibleCount, setMostLovedVisibleCount] = React.useState(0);
  const [mostLovedNextPage, setMostLovedNextPage] = React.useState(2);
  const [isMostLovedPrefetching, setIsMostLovedPrefetching] = React.useState(false);
  const [hasMoreMostLoved, setHasMoreMostLoved] = React.useState(true);
  const [hasMostLovedError, setHasMostLovedError] = React.useState(false);
  const [pendingMostLovedReveal, setPendingMostLovedReveal] = React.useState(false);

  const navigateTo = React.useCallback(
    (to: string) => {
      router.push(to as any);
    },
    [router]
  );

  /**
   * Product taps go through here so the detail fetch starts at tap time and
   * overlaps the navigation animation, instead of only beginning once the
   * product screen has mounted.
   */
  const openProduct = React.useCallback(
    (id: string) => {
      prefetchProduct(queryClient, id);
      router.push(`/product/${id}` as any);
    },
    [queryClient, router]
  );

  const handleTryAndBuy = React.useCallback(
    (productId: string) => {
      router.push({ pathname: "/(tabs)/try-buy", params: { productId } });
    },
    [router]
  );

  const gridPageWidth = Math.max(width - spacing.pageHorizontal * 2, 280);
  const isPhone = width < 768;
  const gridPageGap = spacing.md;
  const gridCardWidth = (gridPageWidth - gridPageGap) / 2;
  const occasionCardHeight = Math.round(gridCardWidth / 0.76);
  const topCategoryGap = 8;
  const topCategoryCardBorder = 1;
  const topCategoryCardWidth = Math.floor(
    (gridPageWidth - topCategoryGap * 3 - topCategoryCardBorder * 8) / 4
  );
  // 4:3 portrait (height = width × 4/3). The previous 0.88 was near-square, which
  // cropped the model's outfit — the thing the category is meant to show.
  const topCategoryImageHeight = Math.round((topCategoryCardWidth * 4) / 3);
  const topCategoryLabelHeight = Math.round(topCategoryCardWidth * 0.32);
  const topCategoryCardHeight = topCategoryImageHeight + topCategoryLabelHeight;
  const categoryCardGap = spacing.md;
  const categoryCardWidth = isPhone
    ? (gridPageWidth - categoryCardGap) / 1.5
    : gridPageWidth;
  const categoryCardHeight = Math.round(categoryCardWidth * 1.34);
  const productCardGap = spacing.md;
  const mostLovedCardWidth = (gridPageWidth - productCardGap) / 2;
  const bestsellerCardWidth = isPhone
    ? (gridPageWidth - productCardGap) / 2
    : gridPageWidth;

  const fallbackGridImages = React.useMemo(
    () => [
      images.categories.wedding,
      images.categories.indoWestern,
      images.categories.kurta,
      images.categories.accessories,
      ...images.hero.mobile,
    ],
    []
  );

  const categoryCards = React.useMemo<HomeGridCard[]>(() => {
    const categories: Category[] = categoriesQuery.data?.categories ?? [];
    // Prefer showing Sable/Wedding first in the grid if present
    const preferred = ["sable", "wedding"];
    const sorted = [...categories].sort((a, b) => {
      const ai = (a.slug || a.name || "").toLowerCase();
      const bi = (b.slug || b.name || "").toLowerCase();
      const aPref = preferred.indexOf(ai) !== -1 ? preferred.indexOf(ai) : Infinity;
      const bPref = preferred.indexOf(bi) !== -1 ? preferred.indexOf(bi) : Infinity;
      return aPref - bPref;
    });

    return sorted.map((category, index) => ({
      id: category.id,
      title: (category.name || "Category").toUpperCase(),
      image:
        category.image?.trim() ||
        fallbackGridImages[index % fallbackGridImages.length],
      query: category.slug || category.name,
    }));
  }, [categoriesQuery.data, fallbackGridImages]);

  const occasionCards = React.useMemo<HomeGridCard[]>(() => {
    const occasions: Occasion[] = occasionsQuery.data?.occasions ?? [];
    // Move Mehndi & Haldi to the front if present
    const preferred = ["mehndi", "haldi"];
    const sorted = [...occasions].sort((a, b) => {
      const ai = (a.slug || a.name || "").toLowerCase();
      const bi = (b.slug || b.name || "").toLowerCase();
      const aPref = preferred.indexOf(ai) !== -1 ? preferred.indexOf(ai) : Infinity;
      const bPref = preferred.indexOf(bi) !== -1 ? preferred.indexOf(bi) : Infinity;
      return aPref - bPref;
    });

    return sorted.map((occasion, index) => ({
      id: occasion.id,
      title: (occasion.name || "Occasion").toUpperCase(),
      image:
        occasion.image?.trim() ||
        fallbackGridImages[index % fallbackGridImages.length],
      query: occasion.slug || occasion.name,
    }));
  }, [fallbackGridImages, occasionsQuery.data]);

  const mostLovedCards = React.useMemo<HomeProductCard[]>(() => {
    const products = mostLovedProducts.slice(0, mostLovedVisibleCount);
    return products.map((item, index) => ({
      id: item.id,
      title: item.title,
      image: item.images?.[0] ?? fallbackGridImages[index % fallbackGridImages.length],
      priceText:
        typeof item.price === "number"
          ? `₹${item.price.toLocaleString("en-IN")}`
          : "₹0",
      categoryText: item.category?.name ?? "Collection",
      query: item.title,
      product: item,
    }));
  }, [fallbackGridImages, mostLovedProducts, mostLovedVisibleCount]);

  const bestsellerCards = React.useMemo<HomeProductCard[]>(() => {
    const products: BestsellerProduct[] = bestsellersQuery.data?.products ?? [];
    return products.map((item, index) => ({
      id: item.id,
      title: item.title,
      image: item.image?.trim() ?? fallbackGridImages[index % fallbackGridImages.length],
      priceText:
        typeof (item.salePrice ?? item.adminPrice ?? item.minPrice ?? item.regularPrice) === "number"
          ? `₹${Number(item.salePrice ?? item.adminPrice ?? item.minPrice ?? item.regularPrice).toLocaleString("en-IN")}`
          : "₹0",
      categoryText: item.categoryName ?? "Collection",
      query: item.title,
      product: {
        id: item.productId ?? item.id,
        title: item.title,
        images: item.image ? [item.image] : [],
        category: item.categoryName ? { name: item.categoryName } : null,
        salePrice: item.salePrice ?? null,
        adminPrice: item.adminPrice ?? null,
        regularPrice: item.regularPrice ?? null,
        compareAtPrice: item.compareAtPrice ?? null,
        sellerPrice: item.sellerPrice ?? null,
        price: item.minPrice ?? undefined,
      },
    }));
  }, [bestsellersQuery.data, fallbackGridImages]);

  const visibleOccasionPages = React.useMemo(
    () => chunkCards(occasionCards, 4),
    [occasionCards]
  );

  const baseOccasionPagesCount = Math.max(1, Math.ceil(occasionCards.length / 4));
  const baseCategoryPagesCount = Math.max(1, categoryCards.length);
  const baseBestsellerPagesCount = Math.max(1, bestsellerCards.length);

  const prefetchNextMostLoved = React.useCallback(async () => {
    if (isMostLovedPrefetching || !hasMoreMostLoved) return;

    setIsMostLovedPrefetching(true);
    setHasMostLovedError(false);

    try {
      const response = await getProducts({
        page: mostLovedNextPage,
        limit: MOST_LOVED_PAGE_SIZE,
        sort: "popularity",
        audience: mostLovedAudience,
      });
      const incoming = (response.data ?? []) as ProductItem[];
      const totalPages = response.pagination?.totalPages;

      setMostLovedProducts((previous) => mergeUniqueProducts(previous, incoming));
      setMostLovedNextPage((previous) => previous + 1);
      setHasMoreMostLoved(
        (typeof totalPages === "number"
          ? mostLovedNextPage < totalPages
          : incoming.length === MOST_LOVED_PAGE_SIZE) && incoming.length > 0
      );
    } catch {
      setHasMostLovedError(true);
      setHasMoreMostLoved(false);
    } finally {
      setIsMostLovedPrefetching(false);
    }
  }, [hasMoreMostLoved, isMostLovedPrefetching, mostLovedAudience, mostLovedNextPage]);

  const revealNextMostLoved = React.useCallback(() => {
    if (mostLovedVisibleCount < mostLovedProducts.length) {
      setMostLovedVisibleCount((previous) =>
        Math.min(previous + MOST_LOVED_PAGE_SIZE, mostLovedProducts.length)
      );
      return;
    }

    if (hasMoreMostLoved) {
      setPendingMostLovedReveal(true);
      void prefetchNextMostLoved();
    }
  }, [
    hasMoreMostLoved,
    mostLovedProducts.length,
    mostLovedVisibleCount,
    prefetchNextMostLoved,
  ]);

  React.useEffect(() => {
    setOccasionPageIndex(0);
  }, [occasionCards.length]);

  React.useEffect(() => {
    setCategoryPageIndex(0);
  }, [categoryCards.length]);

  React.useEffect(() => {
    setBestsellerPageIndex(0);
  }, [bestsellerCards.length]);

  React.useEffect(() => {
    setMostLovedProducts([]);
    setMostLovedVisibleCount(0);
    setMostLovedNextPage(2);
    setHasMoreMostLoved(true);
    setHasMostLovedError(false);
    setPendingMostLovedReveal(false);
  }, [mostLovedAudience]);

  React.useEffect(() => {
    const products = ((mostLovedQuery.data?.data ?? []) as ProductItem[]);
    if (!mostLovedQuery.data) return;

    const totalPages = mostLovedQuery.data.pagination?.totalPages;
    setMostLovedProducts(mergeUniqueProducts([], products));
    setMostLovedVisibleCount(Math.min(MOST_LOVED_PAGE_SIZE, products.length));
    setMostLovedNextPage(2);
    setHasMoreMostLoved(
      typeof totalPages === "number" ? totalPages > 1 : products.length === MOST_LOVED_PAGE_SIZE
    );
    setHasMostLovedError(false);
    setPendingMostLovedReveal(false);
  }, [mostLovedAudience, mostLovedQuery.data]);

  React.useEffect(() => {
    if (mostLovedQuery.isLoading) return;
    if (!hasMoreMostLoved || isMostLovedPrefetching) return;
    if (mostLovedProducts.length - mostLovedVisibleCount >= MOST_LOVED_PAGE_SIZE) return;

    void prefetchNextMostLoved();
  }, [
    hasMoreMostLoved,
    isMostLovedPrefetching,
    mostLovedProducts.length,
    mostLovedQuery.isLoading,
    mostLovedVisibleCount,
    prefetchNextMostLoved,
  ]);

  React.useEffect(() => {
    if (!pendingMostLovedReveal) return;

    if (mostLovedVisibleCount < mostLovedProducts.length) {
      setMostLovedVisibleCount((previous) =>
        Math.min(previous + MOST_LOVED_PAGE_SIZE, mostLovedProducts.length)
      );
      setPendingMostLovedReveal(false);
      return;
    }

    if (!hasMoreMostLoved && !isMostLovedPrefetching) {
      setPendingMostLovedReveal(false);
    }
  }, [
    hasMoreMostLoved,
    isMostLovedPrefetching,
    mostLovedProducts.length,
    mostLovedVisibleCount,
    pendingMostLovedReveal,
  ]);

  const renderGridPage = React.useCallback(
    ({ item }: ListRenderItemInfo<HomeGridPage>) => (
      <View style={[styles.gridPage, { width: gridPageWidth }]}> 
        {item.items.map((card) => (
          <Pressable
            key={card.id}
            style={[styles.occasionCard, { width: gridCardWidth }]}
            onPress={() => navigateTo(`/search?q=${encodeURIComponent(card.query)}`)}
          >
            <CachedImage
              source={card.image}
              style={styles.occasionCardImage}
              contentFit="cover"
            />
            <View pointerEvents="none" style={styles.occasionCardOverlay} />
            <BottomWineFade />
            <RectGradientBorder
              width={gridCardWidth}
              height={occasionCardHeight}
              strokeWidth={3.1}
            />
            <Text style={styles.occasionCardTitle}>{card.title}</Text>
          </Pressable>
        ))}
      </View>
    ),
    [navigateTo, gridCardWidth, gridPageWidth, occasionCardHeight]
  );

  const topCategoryCards = categoryCards;

  const renderTopCategoryCard = React.useCallback(
    (item: HomeGridCard) => (
      <Pressable
        key={item.id}
        style={[
          styles.topCategoryCard,
          { width: topCategoryCardWidth, height: topCategoryCardHeight },
        ]}
        onPress={() => navigateTo(`/search?q=${encodeURIComponent(item.query)}`)}
      >
        <View style={{ width: topCategoryCardWidth, height: topCategoryImageHeight }}>
          <CachedImage
            source={item.image}
            style={{ width: topCategoryCardWidth, height: topCategoryImageHeight }}
            contentFit="cover"
          />
        </View>
        <View
          style={[
            styles.topCategoryLabelWrap,
            { height: topCategoryLabelHeight, width: topCategoryCardWidth },
          ]}
        >
          <Text style={styles.topCategoryLabel} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      </Pressable>
    ),
    [
      navigateTo,
      topCategoryCardHeight,
      topCategoryCardWidth,
      topCategoryImageHeight,
      topCategoryLabelHeight,
    ]
  );

  const renderCategoryCard = React.useCallback(
    ({ item }: ListRenderItemInfo<HomeGridCard>) => (
      <Pressable
        style={[
          styles.categoryCard,
          { width: categoryCardWidth, height: categoryCardHeight },
        ]}
        onPress={() => navigateTo(`/search?q=${encodeURIComponent(item.query)}`)}
      >
        <CachedImage
          source={item.image}
          style={{ width: categoryCardWidth, height: categoryCardHeight }}
          contentFit="cover"
        />
        <View pointerEvents="none" style={styles.categoryCardOverlay} />
        <BottomWineFade />
        <ArchGradientBorder
          width={categoryCardWidth}
          height={categoryCardHeight}
          topRadius={categoryCardWidth / 2}
          strokeWidth={3.1}
        />
        <Text style={styles.categoryCardTitle}>{item.title}</Text>
      </Pressable>
    ),
    [categoryCardHeight, categoryCardWidth, navigateTo]
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

  // Card widths are held as memoised style objects rather than written inline.
  //
  // `style={{ width: n }}` builds a fresh object on every call, and MarketplaceCard
  // is wrapped in React.memo — which compares props by identity. A new object every
  // time means the comparison always fails, so every visible card re-rendered
  // whenever anything on this screen changed state. During a scroll, with several
  // horizontal lists mounted, that is the frame budget gone.
  const mostLovedCardStyle = React.useMemo(
    () => ({ width: mostLovedCardWidth }),
    [mostLovedCardWidth]
  );
  const bestsellerCardStyle = React.useMemo(
    () => ({ width: bestsellerCardWidth }),
    [bestsellerCardWidth]
  );

  const renderLargeProductCard = React.useCallback(
    ({ item }: ListRenderItemInfo<HomeProductCard>) => (
      <MarketplaceCard
        product={item.product}
        onPress={openProduct}
        onTryAndBuy={handleTryAndBuy}
        onQuickAdd={openQuickAdd}
        onBuyNow={openBuyNow}
        style={mostLovedCardStyle}
        imageWidth={mostLovedCardWidth}
      />
    ),
    [mostLovedCardStyle, mostLovedCardWidth, openProduct, handleTryAndBuy, openQuickAdd, openBuyNow]
  );

  const renderBestsellerCard = React.useCallback(
    ({ item }: ListRenderItemInfo<HomeProductCard>) => (
      <MarketplaceCard
        product={item.product}
        onPress={openProduct}
        onTryAndBuy={handleTryAndBuy}
        onQuickAdd={openQuickAdd}
        onBuyNow={openBuyNow}
        style={bestsellerCardStyle}
        imageWidth={bestsellerCardWidth}
      />
    ),
    [bestsellerCardStyle, bestsellerCardWidth, openProduct, handleTryAndBuy, openQuickAdd, openBuyNow]
  );

  const handleScroll = React.useCallback((offsetY: number) => {
    const shouldShow = offsetY > 260;
    setShowScrollTop((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);

  const handleListScroll = React.useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      handleScroll(contentOffset.y);

      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceFromBottom < 900) {
        revealNextMostLoved();
      }
    },
    [handleScroll, revealNextMostLoved]
  );

  const handleScrollToTop = React.useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // Stable identities so the list is not rebuilt on every render.
  const homeSectionKey = React.useCallback(
    (item: { key: string }) => item.key,
    []
  );
  const renderHomeSection = React.useCallback(
    ({ item }: { item: { key: string; node: React.ReactNode } }) => <>{item.node}</>,
    []
  );

  // The home page was one ScrollView wrapping every section at once.
  // A ScrollView mounts and renders all of its children immediately, so the
  // hero, product rails and the footer were
  // all live simultaneously — and stayed live for the whole session. Scrolling
  // then had to composite that entire tree every frame.
  //
  // Each section is now an item in a FlatList, which windows them: only what is
  // near the viewport is mounted. Same content, same order, same styling.
  const homeSections = React.useMemo(() => [
    { key: "topCategories", node: (
            topCategoryCards.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.topCategoryScroll}
                contentContainerStyle={[
                  styles.topCategoryRow,
                  { gap: topCategoryGap },
                ]}
              >
                {topCategoryCards.map(renderTopCategoryCard)}
              </ScrollView>
            ) : null
    ) },
    { key: "hero", node: (
            <View style={styles.fullBleed}>
              <HomeHeroBanner onPress={() => navigateTo("/marketplace")} />
            </View>
    ) },
    { key: "occasions", node: (
            <View style={styles.occasionSection}>
              <View style={styles.occasionHeadingWrap}>
                <SectionMark color="#0C1B42" width={30} />
                <Text style={styles.occasionTitle}>SHOP THE OCCASION</Text>
                <View style={styles.menTabWrap}>
                  <Text style={styles.menTabText}>Men</Text>
                  <View style={styles.menTabUnderline} />
                </View>
                <Text style={styles.scrollDirectionText}>Swipe left or right</Text>
              </View>
              {occasionsQuery.isLoading ? (
                <View style={styles.gridLoadingWrap}>
                  <SkeletonBlock width="47%" height={170} />
                  <SkeletonBlock width="47%" height={170} />
                  <SkeletonBlock width="47%" height={170} />
                  <SkeletonBlock width="47%" height={170} />
                </View>
              ) : occasionsQuery.isError && visibleOccasionPages.length === 0 ? (
                <SectionError
                  message="We couldn't load occasions."
                  onRetry={() => void refetchOccasions()}
                />
              ) : visibleOccasionPages.length === 0 ? (
                <View style={styles.gridEmptyState}>
                  <Text style={styles.gridEmptyText}>No occasions available right now.</Text>
                </View>
              ) : (
                <FlatList
                  data={visibleOccasionPages}
                  keyExtractor={(item) => item.id}
                  renderItem={renderGridPage}
                  horizontal
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  decelerationRate="fast"
                  disableIntervalMomentum
                  snapToAlignment="start"
                  snapToInterval={gridPageWidth + gridPageGap}
                  style={styles.gridViewport}
                  contentContainerStyle={styles.occasionGrid}
                  ItemSeparatorComponent={OccasionSeparator}
                  showsHorizontalScrollIndicator={false}
                  onScroll={(event) => {
                    const page = Math.round(
                      event.nativeEvent.contentOffset.x / (gridPageWidth + gridPageGap)
                    );
                    setOccasionPageIndex((prev) => (prev === page ? prev : page));
                  }}
                  scrollEventThrottle={100}
                  onMomentumScrollEnd={(event) => {
                    const page = Math.round(
                      event.nativeEvent.contentOffset.x / (gridPageWidth + gridPageGap)
                    );
                    setOccasionPageIndex((prev) => (prev === page ? prev : page));
                  }}
                />
              )}
              {visibleOccasionPages.length > 0 ? (
                <View style={styles.paginationWrap}>
                  {Array.from({ length: baseOccasionPagesCount }).map((_, idx) => {
                    const isActive = idx === (occasionPageIndex % baseOccasionPagesCount);
                    return <View key={`occasion-dot-${idx}`} style={[styles.paginationDot, isActive && styles.paginationDotActive]} />;
                  })}
                </View>
              ) : null}
            </View>
    ) },
    { key: "categories", node: (
            <View style={[styles.collectionSection, styles.compactCarouselSection]}>
              <View style={styles.sectionHeadRow}>
                <SectionMark color="#0C1B42" />
                <Text style={styles.collectionHeading}>SHOP BY CATEGORY</Text>
              </View>
              {categoryCards.length < 8 ? (
                <Text style={[styles.scrollDirectionText, styles.centerDirection]}>Swipe left or right</Text>
              ) : null}
              {categoriesQuery.isLoading ? (
                <View style={styles.gridLoadingWrap}>
                  <SkeletonBlock width="47%" height={170} />
                  <SkeletonBlock width="47%" height={170} />
                  <SkeletonBlock width="47%" height={170} />
                  <SkeletonBlock width="47%" height={170} />
                </View>
              ) : categoriesQuery.isError && categoryCards.length === 0 ? (
                <SectionError
                  message="We couldn't load categories."
                  onRetry={() => void refetchCategories()}
                />
              ) : categoryCards.length === 0 ? (
                <View style={styles.gridEmptyState}>
                  <Text style={styles.gridEmptyText}>No categories available right now.</Text>
                </View>
              ) : (
                // If we have enough categories, show a compact 4x2 grid (8 items)
                (categoryCards.length >= 8) ? (
                  <View style={styles.categoryGridWrap}>
                    {(() => {
                      const items = categoryCards.slice(0, 8);
                      const smallGap = 10;
                      const cols = 4;
                      const totalGap = smallGap * (cols - 1);
                      const smallWidth = Math.floor((gridPageWidth - totalGap) / cols);
                      const smallHeight = Math.round(smallWidth * 1.4);

                      const renderCompactCard = (card: HomeGridCard) => (
                        <Pressable
                          key={card.id}
                          style={[styles.compactCategoryCard, { width: smallWidth, height: smallHeight }]}
                          onPress={() => navigateTo(`/search?q=${encodeURIComponent(card.query)}`)}
                        >
                          <CachedImage
                            source={card.image}
                            style={{ width: smallWidth, height: smallHeight }}
                            contentFit="cover"
                          />
                          <View pointerEvents="none" style={styles.compactCategoryScrim} />
                          <View pointerEvents="none" style={styles.compactCategoryRing} />
                          <Text
                            style={styles.compactCategoryTitle}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                          >
                            {card.title}
                          </Text>
                        </Pressable>
                      );

                      return (
                        <>
                          <View style={[styles.categoryGridRow, { gap: smallGap }]}>
                            {items.slice(0, 4).map(renderCompactCard)}
                          </View>
                          <View style={[styles.categoryGridRow, { gap: smallGap, marginTop: smallGap }]}>
                            {items.slice(4, 8).map(renderCompactCard)}
                          </View>
                        </>
                      );
                    })()}
                  </View>
                ) : (
                  <FlatList
                    data={categoryCards}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCategoryCard}
                    horizontal
                    initialNumToRender={1}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    updateCellsBatchingPeriod={24}
                    decelerationRate="fast"
                    disableIntervalMomentum
                    snapToAlignment="start"
                    snapToInterval={categoryCardWidth + categoryCardGap}
                    style={[
                      styles.categoryCarouselViewport,
                      { height: categoryCardHeight + spacing.sm },
                    ]}
                    contentContainerStyle={styles.categoryCarouselContent}
                    showsHorizontalScrollIndicator={false}
                    onScroll={(event) => {
                      const page = Math.round(event.nativeEvent.contentOffset.x / (categoryCardWidth + categoryCardGap));
                      setCategoryPageIndex((prev) => (prev === page ? prev : page));
                    }}
                    scrollEventThrottle={100}
                    onMomentumScrollEnd={(event) => {
                      const page = Math.round(event.nativeEvent.contentOffset.x / (categoryCardWidth + categoryCardGap));
                      setCategoryPageIndex((prev) => (prev === page ? prev : page));
                    }}
                  />
                )
              )}
              {categoryCards.length > 0 && categoryCards.length < 8 ? (
                <View style={[styles.paginationWrap, styles.compactPaginationWrap]}>
                  {Array.from({ length: baseCategoryPagesCount }).map((_, idx) => {
                    const isActive = idx === (categoryPageIndex % baseCategoryPagesCount);
                    return <View key={`category-dot-${idx}`} style={[styles.paginationDot, isActive && styles.paginationDotActive]} />;
                  })}
                </View>
              ) : null}
            </View>
    ) },
    { key: "bestsellers", node: (
            <View style={[styles.mostLovedSection, styles.compactCarouselSection]}>
              <View style={styles.mostLovedHeaderRow}>
                <SectionMark color="#0C1B42" />
                <Text style={styles.mostLovedHeading}>BEST SELLERS</Text>
                <Text style={styles.scrollDirectionText}>Swipe left or right</Text>
              </View>
              <View style={styles.audienceTabsWrap}>
                <AudienceTabs value={bestsellersAudience} onChange={setBestsellersAudience} />
              </View>
              {bestsellersQuery.isLoading ? (
                <View style={styles.gridLoadingWrap}>
                  <SkeletonBlock width="47%" height={220} />
                  <SkeletonBlock width="47%" height={220} />
                </View>
              ) : bestsellersQuery.isError && bestsellerCards.length === 0 ? (
                <SectionError
                  message="We couldn't load best sellers."
                  onRetry={() => void refetchBestsellers()}
                />
              ) : bestsellerCards.length === 0 ? (
                <View style={styles.gridEmptyState}>
                  <Text style={styles.gridEmptyText}>
                    No {bestsellersAudience === "MENS" ? "mens" : "kids"} bestsellers available right now.
                  </Text>
                </View>
              ) : (
                <FlatList
                  horizontal
                  data={bestsellerCards}
                  keyExtractor={(item) => item.id}
                  renderItem={renderBestsellerCard}
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  contentContainerStyle={styles.largeProductList}
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={bestsellerCardWidth + productCardGap}
                  decelerationRate="fast"
                  disableIntervalMomentum
                  snapToAlignment="start"
                  onScroll={(event) => {
                    const page = Math.round(
                      event.nativeEvent.contentOffset.x / (bestsellerCardWidth + productCardGap)
                    );
                    setBestsellerPageIndex((prev) => (prev === page ? prev : page));
                  }}
                  scrollEventThrottle={100}
                  onMomentumScrollEnd={(event) => {
                    const page = Math.round(
                      event.nativeEvent.contentOffset.x / (bestsellerCardWidth + productCardGap)
                    );
                    setBestsellerPageIndex((prev) => (prev === page ? prev : page));
                  }}
                />
              )}
              {bestsellerCards.length > 0 ? (
                <View style={[styles.paginationWrap, styles.compactPaginationWrap]}>
                  {Array.from({ length: baseBestsellerPagesCount }).map((_, idx) => {
                    const isActive = idx === (bestsellerPageIndex % baseBestsellerPagesCount);
                    return <View key={`bestseller-dot-${idx}`} style={[styles.paginationDot, isActive && styles.paginationDotActive]} />;
                  })}
                </View>
              ) : null}
            </View>
    ) },
    { key: "mostLoved", node: (
            <View style={styles.mostLovedSection}>
              <View style={styles.mostLovedHeaderRow}>
                <SectionMark color="#0C1B42" />
                <Text style={styles.mostLovedHeading}>MOST LOVED</Text>
              </View>
              <View style={styles.audienceTabsWrap}>
                <AudienceTabs value={mostLovedAudience} onChange={setMostLovedAudience} />
              </View>
              {mostLovedQuery.isLoading ? (
                <View style={styles.gridLoadingWrap}>
                  <SkeletonBlock width="47%" height={240} />
                  <SkeletonBlock width="47%" height={240} />
                </View>
              ) : mostLovedQuery.isError && mostLovedCards.length === 0 ? (
                <SectionError
                  message="We couldn't load popular products."
                  onRetry={() => void refetchMostLoved()}
                />
              ) : mostLovedCards.length === 0 ? (
                <View style={styles.gridEmptyState}>
                  <Text style={styles.gridEmptyText}>
                    No {mostLovedAudience === "MENS" ? "men's" : "kids'"} products available right now.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={mostLovedCards}
                  keyExtractor={(item) => item.id}
                  renderItem={renderLargeProductCard}
                  numColumns={2}
                  initialNumToRender={2}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  scrollEnabled={false}
                  contentContainerStyle={styles.mostLovedGridList}
                  columnWrapperStyle={styles.mostLovedGridRow}
                />
              )}
              {hasMostLovedError ? (
                <Text style={styles.mostLovedStatusText}>Could not load more products right now.</Text>
              ) : isMostLovedPrefetching ? (
                <Text style={styles.mostLovedStatusText}>Loading next products...</Text>
              ) : hasMoreMostLoved ? (
                <Text style={styles.mostLovedStatusText}>Scroll down to reveal more products</Text>
              ) : mostLovedCards.length > 0 ? (
                <Text style={styles.mostLovedStatusText}>You have reached the end.</Text>
              ) : null}
            </View>
    ) },
    { key: "footer", node: (
            <View style={styles.fullBleed}>
              <Footer />
            </View>
    ) },
  ], [
    categoriesQuery.isLoading,
    categoriesQuery.isError,
    refetchCategories,
    navigateTo,
    baseCategoryPagesCount,
    baseOccasionPagesCount,
    baseBestsellerPagesCount,
    bestsellersQuery.isLoading,
    bestsellersQuery.isError,
    refetchBestsellers,
    categoryCards,
    categoryPageIndex,
    gridPageGap,
    gridPageWidth,
    mostLovedQuery.isLoading,
    mostLovedQuery.isError,
    refetchMostLoved,
    mostLovedCards,
    occasionPageIndex,
    occasionsQuery.isLoading,
    occasionsQuery.isError,
    refetchOccasions,
    renderLargeProductCard,
    renderBestsellerCard,
    renderGridPage,
    renderCategoryCard,
    bestsellerCardWidth,
    categoryCardGap,
    categoryCardHeight,
    categoryCardWidth,
    productCardGap,
    bestsellerCards,
    bestsellerPageIndex,
    visibleOccasionPages,
    topCategoryCards,
    topCategoryGap,
    renderTopCategoryCard,
    hasMoreMostLoved,
    hasMostLovedError,
    isMostLovedPrefetching,
    bestsellersAudience,
    mostLovedAudience,
  ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <AppHeader variant="main" />
      <FlatList
        ref={listRef}
        data={homeSections}
        keyExtractor={homeSectionKey}
        renderItem={renderHomeSection}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        onScroll={handleListScroll}
        // Was 16ms — 60 JS calls a second to flip one boolean and measure
        // distance-to-bottom. Neither answer changes meaningfully inside 200ms,
        // and at 16ms this ran in direct competition with the scroll it served.
        scrollEventThrottle={200}
        // Sections are large and few, so render a couple ahead of the viewport
        // and keep a small window. The hero must be present on first paint.
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        // Not enabled: several sections contain reanimated entrance animations,
        // and detaching a view mid-animation is a native crash on Android.
        removeClippedSubviews={false}
      />

      <ScrollToTopFab
        visible={showScrollTop}
        onPress={handleScrollToTop}
      />
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
  contentContainer: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: 0,
    paddingBottom: 0,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  sectionTitleCenter: {
    color: colors.textPrimary,
    textAlign: "center",
  },
  fullBleed: {
    marginHorizontal: -spacing.pageHorizontal,
  },
  topCategoryScroll: {
    marginHorizontal: -spacing.pageHorizontal,
  },
  topCategoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  topCategoryCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E3E8F1",
    backgroundColor: "#FFFFFF",
  },
  topCategoryLabelWrap: {
    borderTopWidth: 1,
    borderTopColor: "#E3E8F1",
    backgroundColor: "#EEF2F9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  topCategoryLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#0C1B42",
  },
  categoryCarouselContent: {
    gap: spacing.md,
    paddingBottom: 0,
  },
  categoryCarouselViewport: {
    flexGrow: 0,
  },
  archGradientBorderWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomWineFade: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryCard: {
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "hidden",
    backgroundColor: "#E3E8F1",
    justifyContent: "flex-end",
    shadowColor: "#0C1B42",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 2,
  },
  categoryCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.03)",
  },
  categoryCardTitle: {
    ...textStyles.sectionTitle,
    position: "absolute",
    bottom: spacing.md,
    width: "100%",
    textAlign: "center",
    color: "#FFFFFF",
    letterSpacing: 1.35,
    fontSize: 22,
    textShadowColor: "rgba(0, 0, 0, 0.48)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  compactCategoryCard: {
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    overflow: "hidden",
    backgroundColor: "#E3E8F1",
    justifyContent: "flex-end",
    shadowColor: "#0C1B42",
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  compactCategoryScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 15, 38, 0.42)",
  },
  compactCategoryRing: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  compactCategoryTitle: {
    position: "absolute",
    bottom: 10,
    left: 4,
    right: 4,
    textAlign: "center",
    color: "#FFFFFF",
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: "700",
    textTransform: "uppercase",
    textShadowColor: "rgba(0, 0, 0, 0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  occasionSection: {
    backgroundColor: "transparent",
    marginHorizontal: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  occasionHeadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  occasionTitle: {
    ...HOME_SECTION_TITLE,
    color: "#0C1B42",
    textAlign: "center",
  },
  menTabWrap: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  menTabText: {
    ...textStyles.sectionTitle,
    color: "#0C1B42",
    textTransform: "none",
    fontSize: 18,
  },
  menTabUnderline: {
    width: 86,
    height: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.primaryAccent,
  },
  occasionGrid: {
    marginTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  categoryGridWrap: {
    marginTop: spacing.sm,
  },
  categoryGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gridPage: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md,
  },
  gridViewport: {
    minHeight: 470,
  },
  gridLoadingWrap: {
    marginTop: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md,
  },
  gridEmptyState: {
    marginTop: spacing.sm,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  gridEmptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
  gridErrorText: {
    color: colors.textSecondary,
    fontFamily: typography.sans,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  sectionRetryButton: {
    minHeight: 44,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.interactive,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionRetryText: {
    color: colors.interactive,
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  occasionCard: {
    aspectRatio: 0.76,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
    borderWidth: 0,
    shadowColor: "#0C1B42",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 12,
    elevation: 2,
  },
  occasionCardImage: {
    width: "100%",
    height: "100%",
  },
  occasionCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  occasionCardLabelBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "36%",
    backgroundColor: "rgba(7, 15, 38, 0.24)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 170, 2, 0.36)",
  },
  occasionCardTextShadeSoft: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "44%",
    backgroundColor: "rgba(7, 15, 38, 0.18)",
  },
  occasionCardTextShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "30%",
    backgroundColor: "rgba(7, 15, 38, 0.38)",
  },
  occasionCardTitle: {
    ...textStyles.sectionTitle,
    position: "absolute",
    bottom: spacing.sm,
    width: "100%",
    textAlign: "center",
    color: "#FFFFFF",
    letterSpacing: 1.1,
    fontSize: 17,
    textShadowColor: "rgba(7, 15, 38, 0.85)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  sectionHeadRow: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  collectionSection: {
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  compactCarouselSection: {
    marginTop: 0,
    gap: spacing.sm,
  },
  scrollDirectionText: {
    marginTop: spacing.xs,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  centerDirection: {
    textAlign: "center",
  },
  paginationWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.sm,
  },
  compactPaginationWrap: {
    marginTop: 0,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 138, 0, 0.28)",
  },
  paginationDotActive: {
    backgroundColor: "#102462",
    width: 8,
    height: 8,
  },
  collectionHeading: {
    ...HOME_SECTION_TITLE,
    color: colors.textPrimary,
    textAlign: "center",
  },
  mostLovedSection: {
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  mostLovedHeaderRow: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  audienceTabsWrap: {
    alignItems: "center",
    marginTop: spacing.xs,
  },
  mostLovedTitleWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  mostLovedHeading: {
    ...HOME_SECTION_TITLE,
    color: colors.textPrimary,
    textAlign: "center",
  },
  largeProductList: {
    paddingRight: spacing.md,
    gap: spacing.md,
  },
  mostLovedGridList: {
    gap: spacing.md,
  },
  mostLovedGridRow: {
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  mostLovedStatusText: {
    marginTop: spacing.sm,
    textAlign: "center",
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
});
