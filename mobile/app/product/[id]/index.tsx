import * as React from "react";
import {
  prefetchProduct,
  PRODUCT_QUERY_STALE_TIME_MS,
} from "../../../src/lib/prefetch-product";
import {
  getProductSeed,
  rememberProductSeed,
  seedToProductDetail,
} from "../../../src/lib/product-seed";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  Platform,
  useWindowDimensions,
  Alert,
  Modal,
  Share,
  InteractionManager,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "../../../src/components/CompatImage";
import { trackPendingCartWrite } from "../../../src/lib/pending-cart";
import { buildSizeOptions } from "../../../src/lib/variantAttributes";
import { Icon } from "../../../src/components/Icon";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, spacing, typography, shadow } from "../../../src/theme/tokens";
import {
  getProductById,
  getProducts,
  type ProductSummary,
  type ProductVariant,
} from "../../../src/services/products";
import { trackRecentlyViewed } from "../../../src/services/personalization";
import {
  fetchProductReviews,
  submitProductReview,
  type Review,
  type ReviewSummary,
} from "../../../src/services/reviews";
import { useAuth } from "../../../src/hooks/useAuth";
import { useCart } from "@/src/providers/CartProvider";
import { useWishlist } from "@/src/providers/WishlistProvider";
import { useNetworkStatus } from "../../../src/hooks/useNetworkStatus";
import { useToast } from "../../../src/providers/ToastProvider";
import { ApiError, isAbortError } from "../../../src/services/api";
import { SkeletonBlock } from "../../../src/components/Skeleton";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../../src/components";
import { BrandLoader } from "../../../src/components/BrandLoader";
import { AnimatedPressable } from "../../../src/components/AnimatedPressable";
import { MarketplaceCard } from "../../../src/components/MarketplaceCard";
import {
  SwipeActionBar,
  type SwipeOrigin,
} from "../../../src/components/SwipeActionBar";
import { FlyToCart } from "../../../src/components/FlyToCart";
import { QuickBuySheet, type QuickBuyIntent } from "../../../src/components/QuickBuySheet";
import { WishlistIcon } from "../../../src/components/WishlistIcon";
import { BrandPromise } from "../../../src/components/BrandPromise";
import { impactMedium, impactLight, notifySuccess } from "../../../src/utils/haptics";
import { AppHeader } from "../../../src/components/AppHeader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  buildReviewImageName,
  uploadReviewImage,
  uploadTryOnImage,
  type ReviewImageAsset,
} from "../../../src/services/imagekit";
import {
  createVirtualTryOn,
  type TryOnResult,
} from "../../../src/services/tryOn";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWER_MIN_WIDTH = 1;

const fallbackImage =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Width of the sweeping fill inside the try-on progress track. */
const TRY_ON_BAR_WIDTH = 220;

const MAX_REVIEW_IMAGES = 3;
const MAX_REVIEW_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TRY_ON_IMAGE_BYTES = 8 * 1024 * 1024;
const RELATED_PRODUCTS_PAGE_SIZE = 8;
/** How close to the bottom counts as "ready for the next page", in px. */
const RELATED_LOAD_MORE_DISTANCE = 600;

// ---------------------------------------------------------------------------
// Memoised sub-components (extracted from render for FlatList perf)
// ---------------------------------------------------------------------------

/** Single gallery image with full-width paging. */
const GalleryImage = React.memo(function GalleryImage({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  return (
    <Image
      source={{ uri }}
      style={[galleryStyles.image, { width, height }]}
      contentFit="cover"
      contentPosition="top center"
      transition={200}
      cachePolicy="memory-disk"
      width={width}
      priority="high"
    />
  );
});

const galleryStyles = StyleSheet.create({
  image: {
    backgroundColor: colors.cream,
  },
});

const ZoomableModalImage = React.memo(function ZoomableModalImage({
  uri,
  onRequestClose,
}: {
  uri: string;
  onRequestClose: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.max(1, Math.min(4, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (savedScale.value < 1.02) {
        savedScale.value = 1;
        scale.value = withSpring(1);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const nextScale = savedScale.value > 1.4 ? 1 : 2.5;
      savedScale.value = nextScale;
      scale.value = withSpring(nextScale);

      if (nextScale === 1) {
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (savedScale.value > 1.02) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      } else {
        translateY.value = event.translationY;
      }
    })
    .onEnd(() => {
      if (savedScale.value <= 1.02 && Math.abs(translateY.value) > 120) {
        runOnJS(onRequestClose)();
        return;
      }

      if (savedScale.value > 1.02) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const composedGesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={viewerStyles.itemWrap}>
        <Animated.Image
          source={{ uri }}
          style={[viewerStyles.image, animatedStyle]}
          resizeMode="contain"
        />
      </View>
    </GestureDetector>
  );
});

const viewerStyles = StyleSheet.create({
  itemWrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

/** Single review row. */
const ReviewRow = React.memo(function ReviewRow({
  review,
}: {
  review: Review;
}) {
  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewName}>
          {review.user?.fullName ?? "Anonymous"}
        </Text>
        <Text style={styles.reviewStars}>
          {"★".repeat(review.rating)}
          {"☆".repeat(5 - review.rating)}
        </Text>
      </View>
      <Text style={styles.reviewBody}>{review.text}</Text>
      {review.images?.length ? (
        <View style={styles.reviewImagesWrap}>
          {review.images.map((uri, idx) => (
            <Image
              key={`${review.id}-${idx}`}
              source={{ uri }}
              style={styles.reviewImageThumb}
              contentFit="cover"
              transition={100}
              width={96}
            />
          ))}
        </View>
      ) : null}
      <Text style={styles.reviewDate}>
        {new Date(review.createdAt).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAvgRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return sum / reviews.length;
}

function normalizeColor(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

/** Accepts `#rgb` or `#rrggbb`, normalised to lowercase `#rrggbb`. */
function normalizeHex(value?: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;

  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (/^#[0-9a-f]{6}$/.test(withHash)) return withHash;
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return null;
}

const colorHexMap: Record<string, string> = {
  white: "#ffffff",
  black: "#0C1B42",
  navy: "#0f172a",
  blue: "#1d4ed8",
  beige: "#f5f5dc",
  cream: "#F8F1E5",
  grey: "#71717a",
  gray: "#71717a",
  maroon: "#7f1d1d",
  green: "#15803d",
  yellow: "#facc15",
  red: "#dc2626",
};

function fallbackColorFromText(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 55%)`;
}

function swatchColorFromLabel(label: string): string {
  const normalized = normalizeColor(label);
  if (!normalized) return "#71717a";

  if (colorHexMap[normalized]) {
    return colorHexMap[normalized];
  }

  if (
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized) ||
    /^rgb\(/i.test(normalized) ||
    /^hsl\(/i.test(normalized) ||
    /^[a-z][a-z\s-]*$/i.test(normalized)
  ) {
    return normalized;
  }

  return fallbackColorFromText(normalized);
}

/**
 * The variant's colour, or "" when it has none. Empty is deliberate: a product
 * without a colour axis shows no swatch row at all rather than a meaningless
 * "Default" circle.
 */
function getVariantColorLabel(variant: ProductVariant): string {
  return variant.color?.trim() || "";
}

// Lightweight HTML cleaner for product descriptions. Splits paragraphs, decodes
// common entities, and strips remaining tags so users see formatted text rather
// than `<p>...</p>` markup.
function htmlToParagraphs(html: string): string[] {
  if (!html) return [];
  const decoded = html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”");

  const blocks = decoded
    .split(/<\/?(?:p|div|br\s*\/?|li)\s*\/?>/i)
    .map((chunk) => chunk.replace(/<[^>]+>/g, "").trim())
    .filter((chunk) => chunk.length > 0);

  return blocks.length > 0 ? blocks : [decoded.replace(/<[^>]+>/g, "").trim()];
}

function mimeTypeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const ext = asset.fileName?.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProductDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const productId = typeof params.id === "string" ? params.id : "";
  const { session } = useAuth();
  const token = session?.accessToken ?? null;
  const userId = session?.user?.id ?? null;
  const { addToCart } = useCart();
  const { toggleWishlist, isWishlisted, mutatingIds: wishlistMutatingIds } = useWishlist();
  const { isConnected } = useNetworkStatus();
  const { showToast } = useToast();

  // ---- State ----
  const [selectedColor, setSelectedColor] = React.useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);
  const [needsSizePrompt, setNeedsSizePrompt] = React.useState(false);
  const scrollRef = React.useRef<ScrollView | null>(null);
  /** y of the size row inside the scroll view, so the nudge can bring it up. */
  const sizeSectionY = React.useRef<number | null>(null);
  const [adding, setAdding] = React.useState(false);
  /** Which CTA is working, so only that button shows a spinner. */
  /** Brief confirmation state on the Add to bag button after a successful write. */
  const [justAdded, setJustAdded] = React.useState(false);
  // Thumbnail flight from the action bar to the cart icon.
  const [flyImage, setFlyImage] = React.useState<string | null>(null);
  const [flyOrigin, setFlyOrigin] = React.useState<{ x: number; y: number } | null>(null);
  const flightOriginRef = React.useRef<{ x: number; y: number } | null>(null);
  const justAddedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = React.useState<ReviewSummary | null>(
    null
  );
  const [rating, setRating] = React.useState(0);
  const [reviewText, setReviewText] = React.useState("");
  const [reviewImages, setReviewImages] = React.useState<ReviewImageAsset[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  const [hasLocalReviewSubmission, setHasLocalReviewSubmission] = React.useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = React.useState(false);

  const [relatedProducts, setRelatedProducts] = React.useState<ProductSummary[]>([]);
  const [loadingRelated, setLoadingRelated] = React.useState(false);
  const [loadingMoreRelated, setLoadingMoreRelated] = React.useState(false);
  const [relatedPage, setRelatedPage] = React.useState(1);
  const [hasMoreRelated, setHasMoreRelated] = React.useState(false);
  const loadingMoreRelatedRef = React.useRef(false);
  const relatedLoadMoreAbortRef = React.useRef<AbortController | null>(null);
  const [tryOnUserImageUri, setTryOnUserImageUri] = React.useState<string | null>(null);
  const [tryOnUserImageAsset, setTryOnUserImageAsset] = React.useState<ReviewImageAsset | null>(null);
  const [tryOnResult, setTryOnResult] = React.useState<TryOnResult | null>(null);
  const [tryOnError, setTryOnError] = React.useState<string | null>(null);
  const [tryOnLoading, setTryOnLoading] = React.useState(false);
  const [isTryOnVisible, setIsTryOnVisible] = React.useState(false);
  // Elapsed seconds shown next to the progress bar. The API gives no percentage,
  // so the bar is a looping sweep and this is the honest signal of progress.
  const [tryOnElapsed, setTryOnElapsed] = React.useState(0);
  // Related products use the same card and grid as Most Loved on the home page.
  // The related section sits inside a card with its own horizontal margin,
  // padding and 1px border. Measuring against the raw window width overflowed the
  // container and clipped the second column.
  const relatedCardWidth = Math.floor(
    (windowWidth - spacing.md * 2 - spacing.md * 2 - 2 - spacing.md) / 2
  );
  const [quickBuyId, setQuickBuyId] = React.useState<string | null>(null);
  const [quickBuyIntent, setQuickBuyIntent] = React.useState<QuickBuyIntent>("cart");
  /**
   * Colour to open the sheet on. Only ever set for *this* product — a related
   * product has its own palette, and seeding it with this page's colour would
   * preselect something that product may not even sell.
   */
  const [quickBuyColor, setQuickBuyColor] = React.useState<string | null>(null);
  const openQuickAdd = React.useCallback((id: string) => {
    setQuickBuyIntent("cart");
    setQuickBuyColor(null);
    setQuickBuyId(id);
  }, []);
  const openBuyNow = React.useCallback((id: string) => {
    setQuickBuyIntent("buy");
    setQuickBuyColor(null);
    setQuickBuyId(id);
  }, []);
  const tryOnProgress = useSharedValue(0);
  const tryOnProgressStyle = useAnimatedStyle(() => ({
    // A sweep rather than a percentage: the API reports no real progress, so
    // pretending to know one would be a lie.
    transform: [{ translateX: (tryOnProgress.value - 1) * TRY_ON_BAR_WIDTH }],
  }));
  const tryOnAbortRef = React.useRef<AbortController | null>(null);

  const WEB_BOTTOM_OFFSET = 16;
  const stickyBottomOffset = Platform.OS === "web"
    ? WEB_BOTTOM_OFFSET
    : Math.max(insets.bottom, spacing.sm);
  const galleryWidth = Math.max(windowWidth, 260);
  const galleryHeight = Math.round(galleryWidth * (4 / 3));
  const stickyActionHeight = 88;
  /** Screen-space top edge of the sticky action bar. */
  const stickyBarTopY = windowHeight - stickyBottomOffset - stickyActionHeight;
  const stickyReserveSpace = stickyBottomOffset + stickyActionHeight + spacing.xl;
  const viewerWidth = Math.max(windowWidth, VIEWER_MIN_WIDTH);
  const isCompactLayout = windowWidth < 380;

  const [galleryIndex, setGalleryIndex] = React.useState(0);
  const [isViewerVisible, setIsViewerVisible] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState(0);

  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (justAddedTimerRef.current) {
        clearTimeout(justAddedTimerRef.current);
      }
      tryOnAbortRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    if (!tryOnLoading) {
      setTryOnElapsed(0);
      tryOnProgress.value = 0;
      return;
    }

    const startedAt = Date.now();
    const ticker = setInterval(() => {
      setTryOnElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    tryOnProgress.value = 0;
    tryOnProgress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );

    return () => {
      clearInterval(ticker);
      tryOnProgress.value = 0;
    };
  }, [tryOnLoading, tryOnProgress]);

  // The list that linked here already rendered this product's title, image,
  // category and price. Handing that record straight to the first render is the
  // difference between "the page was already open" and "a skeleton, then the
  // page" — the round trip only ever has to fill in variants.
  const placeholderProduct = React.useMemo(() => {
    const seed = getProductSeed(productId);
    return seed ? { product: seedToProductDetail(seed) } : undefined;
  }, [productId]);

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: ({ signal }) => getProductById(productId, signal),
    enabled: Boolean(productId),
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
    gcTime: 1000 * 60 * 60,
    placeholderData: placeholderProduct,
  });

  const product = productQuery.data?.product ?? null;
  // Only true before anything at all is renderable. With a seed present this
  // never flips on, so the skeleton branch below is skipped entirely. Guarded on
  // productId so a route with no id falls through to "Product unavailable"
  // rather than sitting on a skeleton that will never resolve.
  const loading = Boolean(productId) && !product && productQuery.isPending;
  // Content is on screen but came from the seed, so variants are not known yet.
  // Distinguishing this from "this product genuinely has no variants" is what
  // keeps the size row from flashing "Variants coming soon" on every open.
  // A failed fetch ends the wait: the placeholder sticks around on error, and
  // holding a skeleton forever would be worse than showing the empty state.
  const isHydratingVariants =
    productQuery.isPlaceholderData &&
    !productQuery.isError &&
    (product?.variants?.length ?? 0) === 0;
  const productNotFound =
    !productId ||
    (productQuery.error instanceof ApiError && productQuery.error.statusCode === 404);

  // Everything below the fold — the try-on card, the promise strip, reviews and
  // the related grid — waits for the navigation transition to finish. Building
  // that tree, and firing its two requests, while the screen is still animating
  // in is what made the push itself stutter. Nothing here is visible until the
  // shopper scrolls, so none of it has any business competing for the first frame.
  const [isSettled, setIsSettled] = React.useState(false);
  React.useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setIsSettled(true);
    });
    return () => handle.cancel();
  }, []);

  // Coming back to a product should be instant too, so keep the full record as
  // the seed for next time. Cheap, and it survives the query cache being gc'd.
  React.useEffect(() => {
    if (product?.id && !productQuery.isPlaceholderData) {
      rememberProductSeed(product);
    }
  }, [product, productQuery.isPlaceholderData]);

  React.useEffect(() => {
    const variants = product?.variants ?? [];
    const currentVariant = variants.find((variant) => variant.id === selectedVariantId);

    if (currentVariant) {
      const nextColor = normalizeColor(getVariantColorLabel(currentVariant));
      setSelectedColor((previousColor) => (
        previousColor === nextColor ? previousColor : nextColor
      ));
      return;
    }

    // A colour has to be chosen for the size row to mean anything: sizes belong
    // to one colour, and with none selected the row pooled every colour's sizes
    // into one deduplicated set — so a two-colour kurta showed five chips that
    // silently belonged to whichever colour happened to be stored first.
    //
    // Defaulting the colour is safe in a way defaulting the size is not. Nobody
    // is sent the wrong colour without seeing it — the swatch and the gallery
    // both show it — whereas a pre-picked size becomes a wrong-size order. So
    // colour gets a default and size deliberately stays empty.
    const colorKeys: string[] = [];
    const stocked = new Set<string>();
    for (const variant of variants) {
      const label = getVariantColorLabel(variant);
      if (!label) continue;
      const key = normalizeColor(label);
      if (!colorKeys.includes(key)) colorKeys.push(key);
      if (variant.inventory == null || variant.inventory.stock > 0) stocked.add(key);
    }

    const preferred = colorKeys.find((key) => stocked.has(key)) ?? colorKeys[0] ?? "";
    setSelectedColor((previousColor) =>
      // Keep the shopper's pick across refetches; only re-default if it is gone.
      previousColor && colorKeys.includes(previousColor) ? previousColor : preferred
    );
  }, [product?.variants, selectedVariantId]);

  // ---- Track recently viewed (fire-and-forget) ----
  // Held until the screen settles: this is analytics, and it was taking a slot
  // in the connection pool away from the product request that the shopper is
  // actually waiting on.
  React.useEffect(() => {
    if (!isSettled || !product?.id || !token) return;

    const controller = new AbortController();
    trackRecentlyViewed(product.id, controller.signal).catch(() => {
      // Silently ignore — not critical
    });

    return () => {
      controller.abort();
    };
  }, [isSettled, product?.id, token]);

  // ---- Fetch the all-products discovery feed ----
  React.useEffect(() => {
    if (!isSettled) return;

    let active = true;
    relatedLoadMoreAbortRef.current?.abort();
    relatedLoadMoreAbortRef.current = null;
    loadingMoreRelatedRef.current = false;

    (async () => {
      setLoadingRelated(true);
      setLoadingMoreRelated(false);
      try {
        const response = await queryClient.fetchQuery({
          queryKey: [
            "products",
            {
              page: 1,
              limit: RELATED_PRODUCTS_PAGE_SIZE,
              categoryId: undefined,
              audience: undefined,
              search: undefined,
              sort: "popularity",
            },
          ],
          queryFn: ({ signal }) =>
            getProducts({
              page: 1,
              limit: RELATED_PRODUCTS_PAGE_SIZE,
              sort: "popularity",
              signal,
            }),
          staleTime: 5 * 60 * 1000,
        });
        if (!active) return;
        setRelatedProducts((response.data ?? []).filter((item) => item.id !== productId));
        setRelatedPage(response.pagination.page);
        setHasMoreRelated(response.pagination.page < response.pagination.totalPages);
      } catch (err) {
        if (isAbortError(err) || !active) return;
        setRelatedProducts([]);
        setHasMoreRelated(false);
      } finally {
        if (active) setLoadingRelated(false);
      }
    })();

    return () => {
      active = false;
      relatedLoadMoreAbortRef.current?.abort();
      relatedLoadMoreAbortRef.current = null;
      loadingMoreRelatedRef.current = false;
    };
  }, [isSettled, productId, queryClient]);

  // ---- Fetch reviews ----
  React.useEffect(() => {
    setHasLocalReviewSubmission(false);
    setReviewImages([]);
  }, [productId]);

  React.useEffect(() => {
    if (!isSettled) return;

    const controller = new AbortController();
    let active = true;

    (async () => {
      try {
        const data = await fetchProductReviews(productId, controller.signal);
        if (active) {
          setReviews(data.reviews);
          setReviewSummary(data.summary);
        }
      } catch (err) {
        if (isAbortError(err) || !active) return;
        if (active) {
          setReviews([]);
          setReviewSummary(null);
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [isSettled, productId]);

  // ---- Derived ----
  const selectedVariant = product?.variants?.find(
    (v: ProductVariant) => v.id === selectedVariantId
  );
  const colorOptions = React.useMemo(() => {
    const variants = product?.variants ?? [];
    const map = new Map<string, { label: string; hex: string | null }>();
    for (const variant of variants) {
      const label = getVariantColorLabel(variant);
      if (!label) continue;
      const key = normalizeColor(label);
      const hex = normalizeHex((variant as { colorHex?: string | null }).colorHex);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { label, hex });
      } else if (!existing.hex && hex) {
        // Any size of this colour carrying the admin-picked swatch wins.
        existing.hex = hex;
      }
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [product?.variants]);

  const variantsForColor = React.useMemo(() => {
    const variants = product?.variants ?? [];
    if (!selectedColor) return variants;
    return variants.filter((variant) => normalizeColor(getVariantColorLabel(variant)) === selectedColor);
  }, [product?.variants, selectedColor]);

  /** One chip per size of the selected colour, in scale order with live stock. */
  const sizeOptions = React.useMemo(
    () => buildSizeOptions(variantsForColor),
    [variantsForColor]
  );

  const selectedColorLabel =
    colorOptions.find((color) => color.key === selectedColor)?.label ?? "";

  /** Stock for the chosen size, or the whole colour while none is chosen. */
  const selectedSizeOption = sizeOptions.find(
    (option) => option.variant.id === selectedVariantId
  );
  const colorHasStock = sizeOptions.some((option) => option.inStock);

  const fallbackVariant = selectedVariant ?? variantsForColor[0] ?? product?.variants?.[0] ?? null;
  const productAny = product as any;
  const salePrice =
    fallbackVariant?.price ??
    productAny?.salePrice ??
    productAny?.adminPrice ??
    productAny?.price ??
    null;
  // Only treat the backend's compare-at as "real" when it's strictly greater than sale.
  const candidateCompareAt =
    fallbackVariant?.compareAtPrice ??
    productAny?.compareAtPrice ??
    productAny?.regularPrice ??
    null;
  const realCompareAt =
    typeof candidateCompareAt === "number" &&
    typeof salePrice === "number" &&
    candidateCompareAt > salePrice
      ? candidateCompareAt
      : null;
  // Price anchoring is a commercial claim. Never synthesize a compare-at price
  // when the catalogue does not provide one.
  const compareAtPrice = realCompareAt;
  const hasDiscount =
    typeof salePrice === "number" &&
    typeof compareAtPrice === "number" &&
    compareAtPrice > salePrice;
  const savingsAmount = hasDiscount ? compareAtPrice - salePrice : 0;
  const discountPercent = hasDiscount
    ? Math.round(((compareAtPrice - salePrice) / compareAtPrice) * 100)
    : 0;
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
      : product?.images?.length
        ? product.images
        : [];
  }, [product?.images, selectedVariant, variantsForColor]);
  // Memoised: it feeds the add-to-cart callbacks, and a fresh array every render
  // would rebuild them on every render too.
  const images = React.useMemo(
    () =>
      selectedColorImages.length
        ? selectedColorImages
        : product?.images?.length
          ? product.images
          : [fallbackImage],
    [selectedColorImages, product?.images]
  );
  // The server aggregates over every review; the local average only covers the
  // page we fetched, so prefer the summary when it is present.
  const avgRating = reviewSummary?.averageRating ?? computeAvgRating(reviews);
  const totalReviewCount = reviewSummary?.totalReviews ?? reviews.length;
  const hasReviews = totalReviewCount > 0;
  // Duplicate-prevention: the backend rejects a second review with a 409; hiding
  // the form when the user's own review is on this page saves that round trip.
  const hasUserReviewed =
    hasLocalReviewSubmission ||
    Boolean(
      userId &&
        reviews.some((r) => r.user?.id === userId || r.userId === userId)
    );
  // Before a size is picked this has to describe the colour as a whole. Reading
  // it off the first size instead said "Out of stock" for a colour that was
  // merely sold out in the smallest size.
  const outOfStock = selectedVariantId
    ? selectedSizeOption != null && !selectedSizeOption.inStock
    : sizeOptions.length > 0 && !colorHasStock;

  React.useEffect(() => {
    setGalleryIndex(0);
  }, [selectedColor, product?.id]);

  // One size is not a choice. Leaving it unpicked only made the shopper tap a
  // chip that had no alternative before the bag would accept the item.
  React.useEffect(() => {
    if (selectedVariantId) return;
    if (sizeOptions.length !== 1) return;
    const only = sizeOptions[0];
    if (!only?.inStock) return;
    setSelectedVariantId(only.variant.id);
  }, [selectedVariantId, sizeOptions]);

  // Clear the "pick a size" nudge as soon as one is picked.
  React.useEffect(() => {
    if (selectedVariantId) setNeedsSizePrompt(false);
  }, [selectedVariantId]);

  /**
   * Ask for a size in place instead of over the top.
   *
   * Add to bag used to open the QuickBuy sheet, which re-rendered the same
   * swatches and chips in a modal above the ones already on screen. Scrolling to
   * the real row and flagging it keeps the shopper in one place.
   */
  const promptForSize = React.useCallback(() => {
    setNeedsSizePrompt(true);
    impactLight();
    if (sizeSectionY.current != null) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, sizeSectionY.current - 90),
        animated: true,
      });
    }
  }, []);

  // ---- Handlers ----
  const handleAddToCart = React.useCallback(async () => {
    if (!token) {
      showToast("Please sign in to add to cart", "info");
      router.push("/login");
      return;
    }
    if (!isConnected) {
      showToast("You're offline. Please check your connection.", "error");
      return;
    }
    if (!product) {
      showToast("Still loading this item — one moment", "info");
      return;
    }
    // Tapped inside the window where the page is painted from the list record
    // but the variants have not landed. Saying "variants are not available"
    // here would be a lie that is about to be false; the picker reads the same
    // query and shows a loader until they arrive.
    if (isHydratingVariants) {
      setQuickBuyIntent("cart");
      setQuickBuyColor(selectedColor || null);
      setQuickBuyId(product.id);
      return;
    }
    // Sold out before unsold: asking a shopper to pick a size from a colour
    // where every size is gone is a dead end dressed up as a next step.
    if (outOfStock) {
      showToast("This variant is out of stock", "info");
      return;
    }
    // Variants are on screen — point at the size row rather than covering it
    // with a sheet that shows the same chips again.
    if (!selectedVariant) {
      promptForSize();
      return;
    }
    if (!fallbackVariant) {
      showToast(
        product.variants?.length
          ? "Select a variant to continue"
          : "Variants are not available for this item",
        "info"
      );
      return;
    }
    if (outOfStock) {
      showToast("This variant is out of stock", "info");
      return;
    }
    // Confirm immediately. The cart store applies the item optimistically and
    // rolls back with an error toast if the write fails, so there is nothing to
    // wait for before telling the shopper it worked — waiting on the round trip
    // was the entire delay.
    impactMedium();
    setJustAdded(true);
    if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
    justAddedTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setJustAdded(false);
    }, 1800);

    // Launch the thumbnail from the action bar toward the cart icon. The toast is
    // deliberately dropped here — the flight already says "it went to the cart",
    // and two confirmations for one action is noise.
    setFlyOrigin(
      flightOriginRef.current ?? {
        x: windowWidth / 2,
        y: stickyBarTopY + stickyActionHeight / 2,
      }
    );
    setFlyImage(images[0] ?? fallbackImage);

    // Fire and forget: the write runs alongside the flight rather than after it.
    void addToCart({
      productId: product.id,
      variantId: fallbackVariant.id,
      quantity: 1,
      preview: {
        title: product.title,
        image: images[0] ?? fallbackImage,
        size: fallbackVariant.size,
        color: fallbackVariant.color ?? null,
        colorHex: (fallbackVariant as { colorHex?: string | null }).colorHex ?? null,
        price: fallbackVariant.price,
        compareAtPrice: fallbackVariant.compareAtPrice ?? null,
      },
    }).catch(() => {
      // CartProvider surfaces the error; the store has already rolled back.
      if (mountedRef.current) setJustAdded(false);
    });
  }, [
    token,
    isConnected,
    product,
    fallbackVariant,
    selectedVariant,
    isHydratingVariants,
    outOfStock,
    addToCart,
    router,
    showToast,
    images,
    windowWidth,
    stickyBarTopY,
    promptForSize,
    selectedColor,
  ]);

  const handleBuyNow = React.useCallback(async () => {
    if (!token) {
      showToast("Please sign in to continue", "info");
      router.push("/login");
      return;
    }
    if (!isConnected) {
      showToast("You're offline. Please check your connection.", "error");
      return;
    }
    if (!product) {
      showToast("Still loading this item — one moment", "info");
      return;
    }
    // Same reasoning as Add to bag: during hydration the picker is the honest
    // place to land, not a "no variants" toast that is about to be wrong.
    if (isHydratingVariants) {
      setQuickBuyIntent("buy");
      setQuickBuyColor(selectedColor || null);
      setQuickBuyId(product.id);
      return;
    }
    if (outOfStock) {
      showToast("This variant is out of stock", "info");
      return;
    }
    // Swipe-to-buy is a committed gesture, so the missing size is asked for in a
    // sheet that can finish the purchase. Add to bag still nudges the inline row
    // instead: it has no follow-through to protect, and covering the swatches
    // the shopper is already reading would be the worse trade there.
    if (!selectedVariant) {
      impactLight();
      setQuickBuyIntent("buy");
      setQuickBuyColor(selectedColor || null);
      setQuickBuyId(product.id);
      return;
    }
    if (!fallbackVariant) {
      showToast(
        product.variants?.length
          ? "Select a variant to continue"
          : "Variants are not available for this item",
        "info"
      );
      return;
    }

    // Navigate FIRST. The cart store already updates optimistically, so the
    // checkout screen shows the item straight away; awaiting the network round-trip
    // here just made the buyer wait on the product screen before anything moved.
    // Checkout waits for this write before placing the order, so there is no race.
    const cartWrite = addToCart({
      productId: product.id,
      variantId: fallbackVariant.id,
      quantity: 1,
      // Seeds the optimistic row so checkout shows the real product and total
      // immediately instead of "Item / Size Default / ₹0".
      preview: {
        title: product.title,
        image: images[0] ?? fallbackImage,
        size: fallbackVariant.size,
        color: fallbackVariant.color ?? null,
        colorHex: (fallbackVariant as { colorHex?: string | null }).colorHex ?? null,
        price: fallbackVariant.price,
        compareAtPrice: fallbackVariant.compareAtPrice ?? null,
      },
    });
    trackPendingCartWrite(cartWrite);

    impactMedium();
    // Scope the checkout to this variant. Buy Now means "buy this", so pinning
    // it is what stops the buyer paying for whatever else was already in their
    // bag; checkout also forwards the id to the backend as `variantIds`, so the
    // order itself is scoped, not just the summary they read. Everything else
    // in the cart is left untouched and is still waiting for them afterwards.
    router.push(
      `/checkout?buyNowVariantId=${encodeURIComponent(fallbackVariant.id)}`
    );

    setAdding(true);
    try {
      await cartWrite;
    } catch {
      // CartProvider handles toast messaging
    } finally {
      if (mountedRef.current) {
        setAdding(false);
      }
    }
  }, [
    token,
    isConnected,
    product,
    fallbackVariant,
    selectedVariant,
    isHydratingVariants,
    outOfStock,
    addToCart,
    router,
    showToast,
    images,
    selectedColor,
  ]);

  const handleSwipeAddToCart = React.useCallback(
    (origin: SwipeOrigin) => {
      // Preserve the swipe handle's centre so the add-to-bag thumbnail flight
      // begins exactly where the shopper released it.
      flightOriginRef.current = origin;
      void handleAddToCart();
    },
    [handleAddToCart]
  );

  const handleSwipeBuyNow = React.useCallback(
    (_origin: SwipeOrigin) => {
      void handleBuyNow();
    },
    [handleBuyNow]
  );

  const handleShareProduct = React.useCallback(async () => {
    try {
      const shareTitle = product?.title?.trim() || "KTMONA product";
      const webUrl = `https://www.ktmona.com/product/${productId}`;
      const deepLink = `ktmona://product/${productId}`;

      // Try to share a deep link (so devices that support URL schemes can open the app),
      // include the web URL as a fallback in the message so recipients without the app
      // can still open the product page in the browser.
      await Share.share({
        title: shareTitle,
        message: `${shareTitle}\n${webUrl}`,
        url: deepLink,
      });
    } catch {
      // no-op on cancel/error
    }
  }, [product?.title, productId]);

  const handleNavigateToTryBuy = React.useCallback(() => {
    router.push({ pathname: "/(tabs)/try-buy", params: { productId } });
  }, [router, productId]);

  const handlePickReviewImages = React.useCallback(async () => {
    if (reviewImages.length >= MAX_REVIEW_IMAGES) {
      setReviewError(`Maximum ${MAX_REVIEW_IMAGES} images allowed.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo library access to attach review images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_REVIEW_IMAGES - reviewImages.length,
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.length) return;

    const nextAssets: ReviewImageAsset[] = [];
    for (const asset of result.assets) {
      if (typeof asset.fileSize === "number" && asset.fileSize > MAX_REVIEW_IMAGE_BYTES) {
        setReviewError(`Image \"${asset.fileName ?? "selected"}\" exceeds 2MB.`);
        return;
      }
      const ext = asset.fileName?.split(".").pop()?.toLowerCase() ?? "jpg";
      nextAssets.push({
        uri: asset.uri,
        fileName: asset.fileName ?? buildReviewImageName(nextAssets.length + 1),
        mimeType: asset.mimeType ?? `image/${ext}`,
      });
    }

    setReviewError(null);
    setReviewImages((prev) => [...prev, ...nextAssets].slice(0, MAX_REVIEW_IMAGES));
  }, [reviewImages.length]);

  const handleRemoveReviewImage = React.useCallback((index: number) => {
    setReviewImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmitReview = React.useCallback(async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (!rating || !reviewText.trim()) {
      setReviewError("Please provide a rating and review.");
      return;
    }
    if (submitting) return;

    setReviewError(null);
    setSubmitting(true);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticReview: Review = {
      id: optimisticId,
      rating,
      text: reviewText.trim(),
      images: reviewImages.map((img) => img.uri),
      createdAt: new Date().toISOString(),
      user: {
        fullName: session?.user?.email ?? session?.user?.phone ?? "You",
      },
    };

    setReviews((prev) => [optimisticReview, ...prev]);
    setHasLocalReviewSubmission(true);

    try {
      // Up to three uploads — running them together rather than one after the
      // other is most of the wait the reviewer sees.
      const uploadedImageUrls = await Promise.all(
        reviewImages.map((image) => uploadReviewImage(image))
      );

      const { review } = await submitProductReview(
        productId,
        { rating, text: reviewText.trim(), images: uploadedImageUrls },
        token
      );

      if (mountedRef.current) {
        // Swap the optimistic row for the saved one instead of blocking on a
        // full re-fetch of the list.
        setReviews((prev) =>
          prev.map((r) => (r.id === optimisticId ? review : r))
        );
        setReviewSummary((prev) => {
          const previousTotal = prev?.totalReviews ?? 0;
          const nextTotal = previousTotal + 1;
          const nextAverage =
            ((prev?.averageRating ?? 0) * previousTotal + review.rating) /
            nextTotal;

          return {
            averageRating: Number(nextAverage.toFixed(1)),
            totalReviews: nextTotal,
            ratingDistribution: {
              ...(prev?.ratingDistribution ?? {}),
              [review.rating]:
                (prev?.ratingDistribution?.[review.rating] ?? 0) + 1,
            },
          };
        });
        setRating(0);
        setReviewText("");
        setReviewImages([]);
        notifySuccess();
        showToast("Review submitted", "success");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setReviews((prev) => prev.filter((r) => r.id !== optimisticId));
      if (err instanceof ApiError && err.statusCode === 409) {
        setHasLocalReviewSubmission(true);
        setReviewError(null);
        showToast("You have already reviewed this product.", "info");
      } else {
        setHasLocalReviewSubmission(false);
        const msg = err instanceof Error ? err.message : "Failed to submit review";
        setReviewError(msg);
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [
    token,
    rating,
    reviewText,
    reviewImages,
    session?.user?.email,
    session?.user?.phone,
    submitting,
    productId,
    router,
    showToast,
  ]);

  const handleTryOnAsset = React.useCallback((asset?: ImagePicker.ImagePickerAsset) => {
    if (!asset) return;
    if (typeof asset.fileSize === "number" && asset.fileSize > MAX_TRY_ON_IMAGE_BYTES) {
      setTryOnError("Choose an image under 8MB for virtual try-on.");
      return;
    }

    setTryOnUserImageUri(asset.uri);
    setTryOnUserImageAsset({
      uri: asset.uri,
      fileName: asset.fileName ?? `tryon-${Date.now()}.jpg`,
      mimeType: mimeTypeFromAsset(asset),
    });
    setTryOnResult(null);
    setTryOnError(null);
  }, []);

  const handleCaptureTryOnPhoto = React.useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow camera access to take a try-on photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.86,
    });

    if (!result.canceled) {
      handleTryOnAsset(result.assets?.[0]);
    }
  }, [handleTryOnAsset]);

  const handlePickTryOnPhoto = React.useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo library access to upload a try-on photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.86,
      allowsMultipleSelection: false,
    });

    if (!result.canceled) {
      handleTryOnAsset(result.assets?.[0]);
    }
  }, [handleTryOnAsset]);

  const handleCreateTryOn = React.useCallback(async () => {
    if (!token) {
      showToast("Please sign in to use virtual try-on", "info");
      router.push("/login");
      return;
    }
    if (!isConnected) {
      showToast("You're offline. Please check your connection.", "error");
      return;
    }
    if (!product || !fallbackVariant) {
      setTryOnError("Select a product variant first.");
      return;
    }
    if (!tryOnUserImageAsset) {
      setTryOnError("Take or upload your photo first.");
      return;
    }

    tryOnAbortRef.current?.abort();
    const controller = new AbortController();
    tryOnAbortRef.current = controller;
    setTryOnLoading(true);
    setTryOnError(null);
    setTryOnResult(null);
    // Show the sheet immediately: generation takes tens of seconds, and the
    // shopper needs to see that something is happening.
    setIsTryOnVisible(true);

    try {
      const uploadedUserImageUrl = await uploadTryOnImage(tryOnUserImageAsset);
      const result = await createVirtualTryOn({
        productId: product.id,
        variantId: fallbackVariant.id,
        userImage: uploadedUserImageUrl,
        signal: controller.signal,
      });
      if (!mountedRef.current) return;
      setTryOnResult(result);
      setIsTryOnVisible(true);
      notifySuccess();
    } catch (err) {
      if (!mountedRef.current || isAbortError(err)) return;
      const msg = err instanceof Error ? err.message : "Virtual try-on failed";
      setTryOnError(msg);
      showToast(msg, "error");
    } finally {
      if (mountedRef.current) setTryOnLoading(false);
    }
  }, [
    token,
    isConnected,
    product,
    fallbackVariant,
    tryOnUserImageAsset,
    router,
    showToast,
  ]);

  // ---- Gallery scroll handler ----
  const handleGalleryScroll = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      const idx = Math.round(offset / galleryWidth);
      setGalleryIndex(idx);
    },
    [galleryWidth]
  );

  const openImageViewer = React.useCallback((index: number) => {
    setViewerIndex(index);
    setIsViewerVisible(true);
  }, []);

  const closeImageViewer = React.useCallback(() => {
    setIsViewerVisible(false);
  }, []);

  // ---- Key extractors & render callbacks (stable refs) ----
  const galleryKeyExtractor = React.useCallback(
    (_item: string, index: number) => `img-${index}`,
    []
  );

  const renderGalleryItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<string>) => (
      <Pressable onPress={() => openImageViewer(index)}>
        <GalleryImage uri={item} width={galleryWidth} height={galleryHeight} />
      </Pressable>
    ),
    [galleryHeight, galleryWidth, openImageViewer]
  );

  const renderViewerItem = React.useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <ZoomableModalImage uri={item} onRequestClose={closeImageViewer} />
    ),
    [closeImageViewer]
  );

  const reviewKeyExtractor = React.useCallback(
    (item: Review) => item.id,
    []
  );

  const renderReviewItem = React.useCallback(
    ({ item }: ListRenderItemInfo<Review>) => <ReviewRow review={item} />,
    []
  );

  const relatedKeyExtractor = React.useCallback((item: ProductSummary) => item.id, []);

  // Keyed by id so the card only has to hand back the id it already knows; the
  // record itself comes from the list we fetched, which is what seeds the next
  // detail screen.
  const relatedById = React.useMemo(() => {
    const map = new Map<string, ProductSummary>();
    for (const item of relatedProducts) map.set(item.id, item);
    return map;
  }, [relatedProducts]);

  const handleRelatedPress = React.useCallback(
    (id: string) => {
      prefetchProduct(queryClient, relatedById.get(id) ?? id);
      router.push({ pathname: "/product/[id]", params: { id } });
    },
    [queryClient, relatedById, router]
  );

  // Hoisted out of the renderer: MarketplaceCard is memoised, and a fresh style
  // object per item would defeat that on every grid re-render. Same reason the
  // home screen keeps `mostLovedCardStyle` beside its grid.
  const relatedCardStyle = React.useMemo(
    () => ({ width: relatedCardWidth }),
    [relatedCardWidth]
  );

  const renderRelatedItem = React.useCallback(
    ({ item }: ListRenderItemInfo<ProductSummary>) => (
      <MarketplaceCard
        product={item}
        onPress={handleRelatedPress}
        onQuickAdd={openQuickAdd}
        onBuyNow={openBuyNow}
        style={relatedCardStyle}
        imageWidth={relatedCardWidth}
      />
    ),
    [handleRelatedPress, relatedCardStyle, relatedCardWidth, openQuickAdd, openBuyNow]
  );

  const handleLoadMoreRelated = React.useCallback(async () => {
    if (
      !product?.id ||
      loadingRelated ||
      loadingMoreRelatedRef.current ||
      !hasMoreRelated
    ) {
      return;
    }

    const controller = new AbortController();
    loadingMoreRelatedRef.current = true;
    relatedLoadMoreAbortRef.current = controller;
    setLoadingMoreRelated(true);
    try {
      const response = await getProducts({
        page: relatedPage + 1,
        limit: RELATED_PRODUCTS_PAGE_SIZE,
        sort: "popularity",
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setRelatedProducts((current) => {
        const seen = new Set([product.id, ...current.map((item) => item.id)]);
        const nextItems = (response.data ?? []).filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        return [...current, ...nextItems];
      });
      setRelatedPage(response.pagination.page);
      setHasMoreRelated(response.pagination.page < response.pagination.totalPages);
    } catch (err) {
      if (isAbortError(err)) return;
      setHasMoreRelated(false);
    } finally {
      if (relatedLoadMoreAbortRef.current === controller) {
        relatedLoadMoreAbortRef.current = null;
        loadingMoreRelatedRef.current = false;
        setLoadingMoreRelated(false);
      }
    }
  }, [
    hasMoreRelated,
    loadingRelated,
    product?.id,
    relatedPage,
  ]);

  const renderRelatedFooter = React.useCallback(() => {
    if (!loadingMoreRelated) return null;
    return (
      <View style={styles.relatedFooterLoader}>
        <BrandLoader size="sm" color={colors.gold} />
      </View>
    );
  }, [loadingMoreRelated]);

  /**
   * Pages the related grid once the page scroll comes to rest near the bottom.
   *
   * Deliberately bound to the settle events rather than `onScroll`: this screen
   * is the heaviest in the app, and a throttled scroll handler would run JS on
   * the shopper's every scroll frame to answer a question that only matters
   * once they stop. `onScrollEndDrag` covers a slow drag that never builds
   * momentum, `onMomentumScrollEnd` the flick — between them there is no way to
   * arrive at the bottom without one firing, and neither costs anything while
   * the finger is moving. handleLoadMoreRelated already guards re-entry and the
   * end of the catalogue, so calling it twice is harmless.
   */
  const handlePageScrollSettled = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceFromBottom <= RELATED_LOAD_MORE_DISTANCE) {
        void handleLoadMoreRelated();
      }
    },
    [handleLoadMoreRelated]
  );

  // ---- Variant press handler (avoids inline closure per-item) ----
  const handleVariantPress = React.useCallback((id: string) => {
    impactLight();
    setSelectedVariantId(id);
  }, []);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader showBack showWishlist showCart />
        <ScrollView contentContainerStyle={styles.container}>
          <SkeletonBlock
            width={galleryWidth}
            height={galleryHeight}
            borderRadius={radius.lg}
            style={{ marginHorizontal: spacing.md, marginTop: spacing.md }}
          />
          <View style={[styles.detailsCard, { marginTop: spacing.lg }]}>
            <SkeletonBlock width="40%" height={10} />
            <SkeletonBlock width="80%" height={20} style={{ marginTop: spacing.sm }} />
            <SkeletonBlock width="100%" height={12} style={{ marginTop: spacing.sm }} />
            <SkeletonBlock width="30%" height={18} style={{ marginTop: spacing.md }} />
            {/* Size chips and the sticky CTA row, so the skeleton matches the
                shape of the page it is standing in for. */}
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} width={52} height={34} />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <SkeletonBlock width="48%" height={44} />
              <SkeletonBlock width="48%" height={44} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader showBack showWishlist showCart />
        <View style={styles.centerCard} accessibilityRole="alert">
          <Text style={styles.emptyTitle}>
            {productNotFound ? "Product unavailable" : "We couldn't load this product"}
          </Text>
          <Text style={styles.emptyMessage}>
            {productNotFound
              ? "This item may no longer be available."
              : "Check your connection and try again."}
          </Text>
          {!productNotFound ? (
            <Pressable
              style={[styles.primaryButton, styles.emptyAction]}
              onPress={() => void productQuery.refetch()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading product"
            >
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.secondaryButton, styles.emptyAction]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader showBack showWishlist showCart />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: stickyReserveSpace }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onScrollEndDrag={handlePageScrollSettled}
        onMomentumScrollEnd={handlePageScrollSettled}
      >
        {/* ---- Image gallery with paging dots ---- */}
        <View style={styles.galleryFrame}>
          <FlatList
            data={images}
            keyExtractor={galleryKeyExtractor}
            horizontal
            pagingEnabled
            snapToInterval={galleryWidth}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={handleGalleryScroll}
            // Drives the visible page counter and dots, so it has to stay
            // responsive — but a paging indicator updating at 30fps rather than
            // 60 is indistinguishable, and halves the bridge traffic while the
            // shopper is swiping through photos.
            scrollEventThrottle={32}
            contentContainerStyle={styles.galleryContainer}
            getItemLayout={(_data, index) => ({
              length: galleryWidth,
              offset: galleryWidth * index,
              index,
            })}
            renderItem={renderGalleryItem}
          />
          {images.length > 1 ? (
            <View style={styles.galleryIndexBadge}>
              <Text style={styles.galleryIndexText}>
                {galleryIndex + 1}/{images.length}
              </Text>
            </View>
          ) : null}
          <Pressable
            style={styles.tryOnOverlay}
            onPress={handleNavigateToTryBuy}
            hitSlop={8}
          >
            <View style={styles.tryOnOverlayIconWrap}>
              <Icon name="scan-outline" size={15} color={colors.warmWhite} />
            </View>
            <View>
              <Text style={styles.tryOnOverlayEyebrow}>Virtual</Text>
              <Text style={styles.tryOnOverlayText}>Try-On</Text>
            </View>
            <Icon name="sparkles-outline" size={12} color={colors.gold} />
          </Pressable>
        </View>

        {/* Dots indicator */}
        {images.length > 1 && (
          <View style={styles.dotsRow}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === galleryIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}

        {productQuery.isError &&
        placeholderProduct &&
        (product.variants?.length ?? 0) === 0 ? (
          <View style={styles.refreshWarning} accessibilityRole="alert">
            <View style={styles.refreshWarningCopy}>
              <Text style={styles.refreshWarningTitle}>Some details are unavailable</Text>
              <Text style={styles.refreshWarningText}>
                Reconnect to refresh sizes, stock and pricing.
              </Text>
            </View>
            <Pressable
              style={styles.refreshWarningButton}
              onPress={() => void productQuery.refetch()}
              accessibilityRole="button"
              accessibilityLabel="Refresh product details"
            >
              <Text style={styles.refreshWarningButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ---- Details card ---- */}
        <View style={styles.detailsCard}>
          <Text style={styles.categoryLabel}>
            {product.category?.name ?? "Curated Collection"}
          </Text>

          <View style={styles.titleRow}>
            <Text style={styles.productTitle}>{product.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pressable
                  onPress={() => {
                    if (!token) {
                      router.push("/login");
                      return;
                    }
                    impactLight();
                    toggleWishlist(product.id);
                  }}
                  disabled={!product || wishlistMutatingIds.has(product?.id ?? "")}
                  style={styles.wishlistInlineButton}
                  hitSlop={8}
                >
                  <WishlistIcon
                    size={22}
                    color={isWishlisted(product.id) ? "#E8453C" : colors.charcoal}
                    filled={isWishlisted(product.id)}
                  />
                </Pressable>

                <Pressable
                  onPress={() => {
                    impactLight();
                    void handleShareProduct();
                  }}
                  style={styles.shareInlineButton}
                  hitSlop={8}
                >
                  <Icon name="share-social-outline" size={20} color={colors.charcoal} />
                </Pressable>
              </View>
          </View>

          <View style={styles.detailsTopRow}>
            <View style={styles.detailsBadge}>
              <Text style={styles.detailsBadgeText}>Luxury Edit</Text>
            </View>
            {/* Blank rather than "N/A" while variants are still in flight — the
                SKU is about to arrive, and claiming it does not exist is wrong. */}
            <Text style={styles.skuText}>
              {fallbackVariant?.sku
                ? `SKU ID- ${fallbackVariant.sku}`
                : isHydratingVariants
                  ? ""
                  : "SKU ID- N/A"}
            </Text>
          </View>

          {/* Reviews are a trust signal, so this block only displays aggregate
              data returned by the review service. */}
          {hasReviews ? (
            <View style={styles.ratingPillRow}>
              <View style={styles.ratingPill}>
                <Text style={styles.ratingPillStar}>★</Text>
                <Text style={styles.ratingPillValue}>{avgRating.toFixed(1)}</Text>
                <Text style={styles.ratingPillDivider}>|</Text>
                <Text style={styles.ratingPillCount}>{totalReviewCount}</Text>
              </View>
              <Text style={styles.ratingPillLabel}>
                {totalReviewCount === 1 ? "verified review" : "verified reviews"}
              </Text>
            </View>
          ) : (
            <View style={styles.ratingPillRow}>
              <Icon name="star" size={14} color={colors.gold} />
              <Text style={styles.ratingPillLabel}>Be the first to review</Text>
            </View>
          )}

          {(() => {
            const paragraphs = htmlToParagraphs(
              product.description ?? "Product details are being prepared."
            );
            return (
              <View style={styles.descriptionAccordion}>
                <Pressable
                  style={styles.descriptionAccordionHeader}
                  onPress={() => setIsDescriptionOpen((current) => !current)}
                  hitSlop={6}
                >
                  <View style={styles.descriptionTitleRow}>
                    <Icon name="document-text-outline" size={16} color={colors.gold} />
                    <Text style={styles.descriptionAccordionTitle}>Description</Text>
                  </View>
                  <Icon
                    name={isDescriptionOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.charcoal}
                  />
                </Pressable>

                {isDescriptionOpen ? (
                  <View style={styles.descriptionWrap}>
                    {paragraphs.map((para, idx) => (
                      <Text key={`desc-${idx}`} style={styles.productDescription}>
                        {para}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })()}

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>MRP (Inclusive of all taxes)</Text>
            <View style={styles.priceValues}>
              <Text style={styles.priceValue}>
                {typeof salePrice === "number" ? currency.format(salePrice) : "—"}
              </Text>
              {hasDiscount && (
                  <Text style={styles.comparePrice}>
                    {currency.format(compareAtPrice)}
                  </Text>
                )}
              {hasDiscount ? (
                <View style={styles.discountPill}>
                  <Text style={styles.discountPillText}>{discountPercent}% OFF</Text>
                </View>
              ) : null}
            </View>
            {hasDiscount ? (
              <Text style={styles.savingsText}>
                You save {currency.format(savingsAmount)}
              </Text>
            ) : null}
          </View>

          {/* Delivery information is finalized against the shipping address in
              checkout; avoid promising a date before that calculation exists. */}
          <View style={styles.infoBlock}>
            <View style={styles.infoRow}>
              <Icon name="cube-outline" size={16} color={colors.gold} />
              <Text style={styles.infoText}>
                Delivery timing and charges are confirmed at checkout
              </Text>
            </View>
          </View>

          {/* Trust strip */}
          <View style={styles.trustStrip}>
            <View style={styles.trustItem}>
              <Icon name="shield-checkmark-outline" size={14} color={colors.gold} />
              <Text style={styles.trustText}>Authentic</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Icon name="refresh-outline" size={14} color={colors.gold} />
              <Text style={styles.trustText}>7-Day Returns</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Icon name="airplane-outline" size={14} color={colors.gold} />
              <Text style={styles.trustText}>Pan-India</Text>
            </View>
          </View>

          {/* Stock indicator — the chosen size once there is one, else the colour. */}
          {fallbackVariant?.inventory != null && (
            <Text
              style={[
                styles.stockText,
                outOfStock && styles.stockTextOut,
              ]}
            >
              {outOfStock
                ? "Out of stock"
                : selectedSizeOption?.lowStock != null
                  ? `Only ${selectedSizeOption.lowStock} left`
                  : "In stock"}
            </Text>
          )}

          {/* Variant selector — the colour row is skipped when the product has
              no colour axis, rather than showing a lone "Default" swatch. */}
          {(isHydratingVariants || colorOptions.length > 0) && (
            <View style={styles.variantRow}>
              <Text style={styles.variantLabel}>
                Select Color{selectedColorLabel ? `  ·  ${selectedColorLabel}` : ""}
              </Text>
              <View style={styles.variantWrap}>
                {isHydratingVariants && !colorOptions.length ? (
                  <View style={styles.variantSkeletonRow}>
                    {[0, 1, 2].map((i) => (
                      <SkeletonBlock key={i} width={72} height={30} borderRadius={radius.sm} />
                    ))}
                  </View>
                ) : (
                  colorOptions.map((color) => {
                    const active = selectedColor === color.key;
                    const swatchSize = isCompactLayout ? 26 : 30;
                    return (
                      <Pressable
                        key={color.key}
                        style={[
                          styles.colorOption,
                          active && styles.colorOptionActive,
                        ]}
                        onPress={() => {
                          setSelectedColor(color.key);
                          const forColor = (product?.variants ?? []).filter(
                            (variant) => normalizeColor(getVariantColorLabel(variant)) === color.key,
                          );
                          // Stay on the size already chosen when the new colour
                          // stocks it; only then fall back to its first size.
                          const sameSize = forColor.find(
                            (variant) => variant.size === selectedVariant?.size,
                          );
                          const next = sameSize ?? buildSizeOptions(forColor)[0]?.variant;
                          if (next) {
                            setSelectedVariantId(next.id);
                          }
                        }}
                      >
                        <View
                          style={[
                            styles.colorSwatch,
                            {
                              width: swatchSize,
                              height: swatchSize,
                              backgroundColor:
                                color.hex ?? swatchColorFromLabel(color.label),
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.colorOptionText,
                            active && styles.colorOptionTextActive,
                          ]}
                        >
                          {color.label}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>
          )}

          <View
            style={styles.variantRow}
            onLayout={(event) => {
              sizeSectionY.current = event.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.variantLabel, needsSizePrompt && styles.variantLabelPrompt]}>
              Select Size
            </Text>
            <View style={styles.variantWrap}>
              {isHydratingVariants && !sizeOptions.length ? (
                <View style={styles.variantSkeletonRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <SkeletonBlock key={i} width={52} height={34} borderRadius={radius.sm} />
                  ))}
                </View>
              ) : sizeOptions.length ? (
                sizeOptions.map((option) => {
                  const active = option.variant.id === selectedVariantId;
                  return (
                    <Pressable
                      key={option.variant.id}
                      style={[
                        styles.variantChip,
                        active && styles.variantChipActive,
                        !option.inStock && styles.variantChipDisabled,
                      ]}
                      onPress={() => handleVariantPress(option.variant.id)}
                      disabled={!option.inStock}
                    >
                      <Text
                        style={[
                          styles.variantChipText,
                          active && styles.variantChipTextActive,
                          !option.inStock && styles.variantChipTextDisabled,
                        ]}
                      >
                        {option.size}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.mutedText}>Variants coming soon.</Text>
              )}
            </View>
            {needsSizePrompt ? (
              <Text style={styles.sizePromptText}>
                Please choose a size to continue.
              </Text>
            ) : null}
          </View>

        </View>

        {/* Everything from here down is off-screen on open. Mounting it in the
            same pass as the gallery is what made the push itself feel heavy. */}
        {!isSettled ? null : (
        <>
        <View style={styles.tryOnCard}>
          <View style={styles.tryOnHeader}>
            <View>
              <Text style={styles.tryOnEyebrow}>Virtual Try-On</Text>
              <Text style={styles.tryOnTitle}>See it on you</Text>
            </View>
            {tryOnResult?.output?.[0] ? (
              <Pressable onPress={() => setIsTryOnVisible(true)} hitSlop={8}>
                <Text style={styles.tryOnViewText}>View result</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.tryOnPreviewRow}>
            <View style={styles.tryOnPreviewBox}>
              {tryOnUserImageUri ? (
                <Image
                  source={{ uri: tryOnUserImageUri }}
                  style={styles.tryOnPreviewImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.tryOnPlaceholderText}>Your photo</Text>
              )}
            </View>
            <View style={styles.tryOnPreviewBox}>
              <Image
                source={{ uri: selectedColorImages[0] ?? images[0] ?? fallbackImage }}
                style={styles.tryOnPreviewImage}
                contentFit="cover"
              />
            </View>
          </View>

          <View style={styles.tryOnActions}>
            <Pressable
              style={styles.tryOnButton}
              onPress={handleCaptureTryOnPhoto}
              disabled={tryOnLoading}
            >
              <Text style={styles.tryOnButtonText}>Camera</Text>
            </Pressable>
            <Pressable
              style={styles.tryOnButton}
              onPress={handlePickTryOnPhoto}
              disabled={tryOnLoading}
            >
              <Text style={styles.tryOnButtonText}>Upload</Text>
            </Pressable>
          </View>

          {tryOnError ? <Text style={styles.errorText}>{tryOnError}</Text> : null}

          <AnimatedPressable
            style={[
              styles.primaryButton,
              (!tryOnUserImageAsset || tryOnLoading) && styles.buttonDisabled,
            ]}
            onPress={handleCreateTryOn}
            disabled={!tryOnUserImageAsset || tryOnLoading}
          >
            {tryOnLoading ? (
              <BrandLoader size="sm" color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Try this product</Text>
            )}
          </AnimatedPressable>
        </View>

        <BrandPromise />

        {/* ---- Reviews section ---- */}
        <View style={styles.reviewsCard}>
          <Text style={styles.sectionTitle}>Customer Reviews</Text>

          {/* Review form — hidden if user already reviewed */}
          {!hasUserReviewed && token ? (
            <View style={styles.reviewForm}>
              <Text style={styles.reviewLabel}>Your rating</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starButton}
                    hitSlop={6}
                  >
                    <Text
                      style={rating >= star ? styles.starActive : styles.starInactive}
                    >
                      ★
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.reviewLabel}>Your review</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Share your thoughts..."
                placeholderTextColor={colors.brownSoft}
                value={reviewText}
                onChangeText={setReviewText}
                multiline
              />

              <Text style={styles.reviewLabel}>Photos (optional)</Text>
              <View style={styles.reviewImageRow}>
                {reviewImages.map((image, index) => (
                  <View key={`${image.uri}-${index}`} style={styles.reviewImagePreviewWrap}>
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.reviewImagePreview}
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={() => handleRemoveReviewImage(index)}
                      style={styles.reviewImageRemoveBtn}
                    >
                      <Text style={styles.reviewImageRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ))}

                {reviewImages.length < MAX_REVIEW_IMAGES && (
                  <Pressable
                    style={styles.reviewImageAddBtn}
                    onPress={handlePickReviewImages}
                    disabled={submitting}
                  >
                    <Text style={styles.reviewImageAddText}>+ Add</Text>
                  </Pressable>
                )}
              </View>

              {reviewError ? (
                <Text style={styles.errorText}>{reviewError}</Text>
              ) : null}
              <AnimatedPressable
                style={[styles.secondaryButton, submitting && styles.buttonDisabled]}
                onPress={handleSubmitReview}
                disabled={submitting}
              >
                {submitting ? (
                  <BrandLoader size="sm" color={colors.charcoal} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Submit review</Text>
                )}
              </AnimatedPressable>
            </View>
          ) : hasUserReviewed ? (
            <Text style={styles.mutedText}>
              You have already reviewed this product.
            </Text>
          ) : (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push("/login")}
            >
              <Text style={styles.secondaryButtonText}>Sign in to review</Text>
            </Pressable>
          )}

          {/* Reviews list — FlatList with optimized rendering */}
          {reviews.length === 0 ? (
            <Text style={[styles.mutedText, { marginTop: spacing.md }]}>
              No reviews yet. Be the first!
            </Text>
          ) : (
            <FlatList
              data={reviews}
              keyExtractor={reviewKeyExtractor}
              renderItem={renderReviewItem}
              scrollEnabled={false}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={3}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>

        {/* ---- Related products ---- */}
        <View style={styles.relatedWrap}>
          <Text style={styles.sectionTitle}>You may also like</Text>

          {loadingRelated ? (
            <View style={styles.relatedLoadingWrap}>
              <BrandLoader size="sm" color={colors.gold} />
            </View>
          ) : relatedProducts.length === 0 ? (
            <Text style={styles.mutedText}>
              More products are coming soon.
            </Text>
          ) : (
            <>
              {/* Two-column grid, matching Most Loved on the home screen.
                  `scrollEnabled={false}` is what makes it a grid rather than a
                  nested scroller: the page's own ScrollView does the scrolling
                  and this simply lays its rows out inline. That also means
                  `onEndReached` can never fire — a list that does not scroll has
                  no end to reach — so paging is driven by the page scroll
                  instead; see handlePageScrollSettled. */}
              <FlatList
                data={relatedProducts}
                keyExtractor={relatedKeyExtractor}
                renderItem={renderRelatedItem}
                numColumns={2}
                scrollEnabled={false}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={5}
                ListFooterComponent={renderRelatedFooter}
                contentContainerStyle={styles.relatedGridList}
                columnWrapperStyle={styles.relatedGridRow}
              />
            </>
          )}
        </View>
        </>
        )}
      </ScrollView>

      <View
        style={[
          styles.stickyActionShell,
          {
            bottom: Platform.OS === "web" ? 0 : stickyBottomOffset,
            paddingBottom: Platform.OS === "web"
              ? spacing.md
              : Math.max(insets.bottom, spacing.xs),
          },
        ]}
      >
        <SwipeActionBar
          leftLabel={
            justAdded
              ? "Added ✓"
              : selectedVariant && outOfStock
                ? "Out of stock"
                : "Add to Bag"
          }
          rightLabel="Buy Now"
          onSwipeLeft={handleSwipeAddToCart}
          onSwipeRight={handleSwipeBuyNow}
          disabled={Boolean(selectedVariant && outOfStock) || adding}
        />
      </View>

      <Modal
        visible={isViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.viewerOverlay}>
          <Pressable
            style={[styles.viewerCloseButton, { top: insets.top + spacing.md }]}
            onPress={closeImageViewer}
          >
            <Text style={styles.viewerCloseText}>Close</Text>
          </Pressable>

          <FlatList
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={viewerIndex}
            keyExtractor={galleryKeyExtractor}
            renderItem={renderViewerItem}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_data, index) => ({
              length: viewerWidth,
              offset: viewerWidth * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const next = Math.round(
                e.nativeEvent.contentOffset.x / viewerWidth
              );
              setViewerIndex(next);
            }}
          />

          <Text style={styles.viewerHintText}>
            {viewerIndex + 1}/{images.length} • Pinch/Double tap • Drag down to close
          </Text>
        </View>
      </Modal>

      <Modal
        visible={isTryOnVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTryOnVisible(false)}
      >
        <View style={styles.tryOnModalOverlay}>
          <View style={styles.tryOnSheet}>
            {/* Header */}
            <View style={styles.tryOnSheetHeader}>
              <View style={styles.tryOnBrandRow}>
                <Text style={styles.tryOnBrand}>TRY ON</Text>
                <Icon name="sparkles" size={13} color={colors.gold} />
              </View>
              <Pressable
                onPress={() => setIsTryOnVisible(false)}
                hitSlop={12}
                style={styles.tryOnCloseButton}
              >
                <Icon name="close" size={22} color={colors.charcoal} />
              </Pressable>
            </View>

            {/* Preview: the result once ready, the shopper's own photo while it renders */}
            <View style={styles.tryOnPreview}>
              {tryOnResult?.output?.[0] ? (
                <Image
                  source={{ uri: tryOnResult.output[0] }}
                  style={styles.tryOnResultImage}
                  contentFit="contain"
                />
              ) : tryOnUserImageUri ? (
                <Image
                  source={{ uri: tryOnUserImageUri }}
                  style={[styles.tryOnResultImage, styles.tryOnPreviewPending]}
                  contentFit="contain"
                />
              ) : (
                <View style={styles.tryOnPreviewEmpty}>
                  <Icon name="shirt-outline" size={40} color={colors.brownSoft} />
                </View>
              )}
            </View>

            {/* Progress, or the error if it failed */}
            {tryOnLoading ? (
              <View style={styles.tryOnProgressBlock}>
                <Text style={styles.tryOnStatusLabel}>Generating…</Text>
                <View style={styles.tryOnProgressRow}>
                  <View style={styles.tryOnProgressTrack}>
                    <Animated.View
                      style={[styles.tryOnProgressFill, tryOnProgressStyle]}
                    />
                  </View>
                  <Text style={styles.tryOnElapsed}>{tryOnElapsed}s</Text>
                </View>
                <Text style={styles.tryOnHint}>
                  This usually takes under a minute. You can keep shopping — we
                  will keep rendering.
                </Text>
              </View>
            ) : tryOnError ? (
              <View style={styles.tryOnProgressBlock}>
                <Text style={styles.tryOnErrorText}>{tryOnError}</Text>
              </View>
            ) : (
              <View style={styles.tryOnProgressBlock}>
                <Text style={styles.tryOnStatusLabel}>Your look is ready</Text>
              </View>
            )}

            <Pressable
              style={styles.tryOnPrimaryButton}
              onPress={() => setIsTryOnVisible(false)}
            >
              <Text style={styles.tryOnPrimaryButtonText}>Continue shopping</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <QuickBuySheet
        productId={quickBuyId}
        intent={quickBuyIntent}
        initialColor={quickBuyColor}
        visible={Boolean(quickBuyId)}
        onClose={() => setQuickBuyId(null)}
      />
      <FlyToCart
        imageUri={flyImage}
        origin={flyOrigin}
        onDone={() => {
          setFlyImage(null);
          setFlyOrigin(null);
          // Straight through. The row is already seeded from `preview`, so the
          // cart renders correctly whether or not the write has landed — waiting
          // on the network here only ever adds dead time.
          if (mountedRef.current) router.push("/cart");
        }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingBottom: spacing.xxl,
  },

  // Gallery
  galleryFrame: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  galleryContainer: {
    paddingHorizontal: 0,
  },
  galleryIndexBadge: {
    position: "absolute",
    bottom: 10,
    right: spacing.lg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(44, 40, 37, 0.65)",
  },
  galleryIndexText: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.warmWhite,
    letterSpacing: 1,
  },
  tryOnOverlay: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 138, 0, 0.70)",
    backgroundColor: "rgba(255, 252, 248, 0.94)",
    shadowColor: colors.charcoal,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  tryOnOverlayIconWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  tryOnOverlayEyebrow: {
    fontFamily: typography.sansMedium,
    fontSize: 8,
    lineHeight: 10,
    color: colors.gold,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  tryOnOverlayText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.charcoal,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.borderSoft,
  },
  dotActive: {
    backgroundColor: colors.gold,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },

  // Details
  detailsCard: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  titleRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  detailsTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  categoryLabel: {
    fontFamily: typography.sans,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.gold,
  },
  detailsBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: "rgba(196, 167, 108, 0.12)",
  },
  detailsBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: 9,
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  productTitle: {
    fontFamily: typography.serif,
    flex: 1,
    fontSize: 26,
    color: colors.charcoal,
    lineHeight: 30,
  },
  wishlistInlineButton: {
    borderRadius: radius.md,
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  shareInlineButton: {
    borderRadius: radius.md,
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.sm,
  },
  ratingPill: {
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F8A5F",
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  ratingPillStar: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 13,
  },
  ratingPillValue: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  ratingPillDivider: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  ratingPillCount: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: "rgba(255,255,255,0.95)",
  },
  ratingPillLabel: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  descriptionAccordion: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
  },
  descriptionAccordionHeader: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  descriptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  descriptionAccordionTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.charcoal,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  descriptionWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 8,
  },
  productDescription: {
    fontFamily: typography.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.brownSoft,
  },
  infoBlock: {
    marginTop: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.cream,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.charcoal,
    flex: 1,
    lineHeight: 16,
  },
  trustStrip: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    justifyContent: "center",
  },
  trustText: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.charcoal,
    fontWeight: "600",
  },
  trustDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.borderSoft,
  },
  priceRow: {
    marginTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingBottom: spacing.md,
  },
  priceLabel: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  priceValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  priceValue: {
    fontFamily: typography.serif,
    fontSize: 34,
    color: colors.charcoal,
  },
  comparePrice: {
    fontFamily: typography.sans,
    fontSize: 14,
    color: colors.brownSoft,
    textDecorationLine: "line-through",
  },
  discountPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: "rgba(196, 167, 108, 0.12)",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  discountPillText: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  savingsText: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  stockText: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 11,
    color: "#5A8F5A",
  },
  stockTextOut: {
    color: colors.gold,
  },

  // Variants
  variantRow: {
    marginTop: spacing.md,
  },
  variantLabel: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  variantLabelPrompt: {
    color: colors.gold,
  },
  sizePromptText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gold,
    marginTop: spacing.xs,
  },
  variantWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  /** Holds the row's height steady while the variants are still arriving, so
      the page does not jump under the shopper's thumb when they land. */
  variantSkeletonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  variantChip: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.warmWhite,
  },
  variantChipActive: {
    borderColor: colors.gold,
    backgroundColor: colors.cream,
  },
  variantChipDisabled: {
    opacity: 0.4,
  },
  variantChipText: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brown,
  },
  variantChipTextActive: {
    color: colors.charcoal,
  },
  variantChipTextDisabled: {
    color: colors.brownSoft,
    textDecorationLine: "line-through",
  },
  colorOption: {
    width: 72,
    alignItems: "center",
    gap: 6,
  },
  colorOptionActive: {
    opacity: 1,
  },
  colorSwatch: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 999,
  },
  colorOptionText: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    width: "100%",
    textAlign: "center",
    lineHeight: 12,
  },
  colorOptionTextActive: {
    color: colors.charcoal,
    fontFamily: typography.sansMedium,
  },

  // Virtual try-on
  tryOnCard: {
    borderRadius: radius.lg,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
  },
  tryOnHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  tryOnEyebrow: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  tryOnTitle: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontSize: 22,
    lineHeight: 26,
    color: colors.charcoal,
  },
  tryOnViewText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tryOnPreviewRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tryOnPreviewBox: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tryOnPreviewImage: {
    width: "100%",
    height: "100%",
  },
  tryOnPlaceholderText: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tryOnActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tryOnButton: {
    borderRadius: radius.md,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.warmWhite,
    paddingVertical: 12,
    alignItems: "center",
  },
  tryOnButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.charcoal,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tryOnModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(20, 18, 16, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  tryOnSheet: {
    borderRadius: radius.xl,
    width: "100%",
    maxHeight: "92%",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  tryOnSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tryOnBrandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tryOnBrand: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    letterSpacing: 3,
    color: colors.charcoal,
  },
  tryOnCloseButton: { padding: spacing.xs },
  tryOnPreview: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
  },
  tryOnPreviewPending: { opacity: 0.45 },
  tryOnPreviewEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  tryOnResultImage: { width: "100%", height: "100%" },
  tryOnProgressBlock: { gap: spacing.sm },
  tryOnStatusLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.charcoal,
    textAlign: "center",
  },
  tryOnProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  tryOnProgressTrack: {
    flex: 1,
    height: 34,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
    justifyContent: "center",
  },
  tryOnProgressFill: {
    width: TRY_ON_BAR_WIDTH,
    height: "100%",
    backgroundColor: colors.gold,
    opacity: 0.35,
  },
  tryOnElapsed: {
    minWidth: 40,
    textAlign: "right",
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.charcoal,
  },
  tryOnHint: {
    fontFamily: typography.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.brownSoft,
    textAlign: "center",
  },
  tryOnErrorText: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: "#7A5656",
    textAlign: "center",
  },
  tryOnPrimaryButton: {
    borderRadius: radius.md,
    backgroundColor: colors.charcoal,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  tryOnPrimaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.warmWhite,
  },

  // Buttons
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.background,
  },
  secondaryButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.charcoal,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  stickyActionShell: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 12,
    elevation: 16,
    paddingTop: 12,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#FFFFFF",
    shadowColor: "#0C1B42",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 12,
  },
  wishlistButton: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  wishlistButtonActive: {
    borderColor: "#E8453C",
    backgroundColor: "#3B1E22",
  },
  skuText: {
    fontFamily: typography.sans,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.brownSoft,
  },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(250, 247, 242, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  loaderText: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },

  // Reviews
  reviewsCard: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  sectionTitle: {
    fontFamily: typography.serif,
    fontSize: 18,
    color: colors.charcoal,
  },
  reviewForm: {
    marginTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  reviewLabel: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: spacing.sm,
  },
  starRow: {
    flexDirection: "row",
    marginTop: spacing.xs,
  },
  starButton: {
    marginRight: spacing.xs,
  },
  starActive: {
    color: colors.gold,
    fontSize: 22,
  },
  starInactive: {
    color: colors.borderSoft,
    fontSize: 22,
  },
  reviewInput: {
    marginTop: spacing.sm,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.charcoal,
    textAlignVertical: "top",
    backgroundColor: colors.background,
  },
  reviewImageRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  reviewImagePreviewWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cream,
  },
  reviewImagePreview: {
    width: "100%",
    height: "100%",
  },
  reviewImageRemoveBtn: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    backgroundColor: colors.charcoal,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewImageRemoveText: {
    color: colors.background,
    fontSize: 13,
    lineHeight: 13,
  },
  reviewImageAddBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  reviewImageAddText: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.brownSoft,
    textTransform: "uppercase",
  },
  reviewItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewName: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.charcoal,
  },
  reviewStars: {
    fontSize: 12,
    color: colors.gold,
  },
  reviewBody: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.brownSoft,
  },
  reviewImagesWrap: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
  },
  reviewImageThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.cream,
  },
  reviewDate: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.borderSoft,
  },
  errorText: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gold,
  },
  mutedText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    marginTop: spacing.sm,
  },

  // Related products
  relatedWrap: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  // Mirrors mostLovedGridList / mostLovedGridRow on the home screen so the two
  // grids read as the same component in two places.
  relatedGridList: {
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  relatedGridRow: {
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  relatedLoadingWrap: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  relatedFooterLoader: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },

  // Utility
  centerCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    ...shadow.card,
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 18,
    color: colors.charcoal,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  emptyMessage: {
    fontFamily: typography.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.brownSoft,
    textAlign: "center",
  },
  emptyAction: {
    minWidth: 180,
    minHeight: 44,
  },
  refreshWarning: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surfaceElevated,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  refreshWarningCopy: {
    flex: 1,
  },
  refreshWarningTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.charcoal,
  },
  refreshWarningText: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.brownSoft,
  },
  refreshWarningButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.interactive,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshWarningButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.interactive,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  viewerCloseButton: {
    position: "absolute",
    top: spacing.xl,
    right: spacing.lg,
    zIndex: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  viewerCloseText: {
    color: "#FFFFFF",
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  viewerHintText: {
    position: "absolute",
    bottom: spacing.xl,
    alignSelf: "center",
    color: "rgba(255,255,255,0.92)",
    fontFamily: typography.sans,
    fontSize: 12,
    letterSpacing: 0.4,
  },
});
