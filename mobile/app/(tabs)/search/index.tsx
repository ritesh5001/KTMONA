import * as React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  Linking,
  useWindowDimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../../src/components/Icon";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing, typography, shadow, radius } from "../../../src/theme/tokens";
import { getCategories } from "../../../src/services/catalog";
import {
  getProductsAndCache,
  getProductsCached,
  type ProductSummary,
} from "../../../src/services/products";
import { prefetchProduct } from "../../../src/lib/prefetch-product";
import { isAbortError } from "../../../src/services/api";

import { SkeletonProductCard } from "../../../src/components/Skeleton";
import { MarketplaceCard } from "../../../src/components/MarketplaceCard";
import { QuickBuySheet, type QuickBuyIntent } from "../../../src/components/QuickBuySheet";
import { getSuggestions, type SuggestionItem, type SortOption } from "../../../src/services/search";
import { AppHeader } from "../../../src/components/AppHeader";
import { BrandLoader } from "../../../src/components/BrandLoader";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../../src/components";
import { useToast } from "../../../src/providers/ToastProvider";

/**
 * Speech recognition is a native module, so it is absent in Expo Go and in any
 * build made before `expo-speech-recognition` was added. Resolve it once here:
 * a failed require must leave voice search disabled, never crash the screen.
 *
 * Loaded at module scope (not in an effect) so `speechModuleRef` is populated
 * before the listener effect below runs on the first commit.
 */
const speechRecognitionModule: SpeechRecognitionModuleLike | null = (() => {
  try {
    // A guarded dynamic require is intentional: a static native-module import
    // would crash older development clients before this fallback can run.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-speech-recognition");
    return mod?.ExpoSpeechRecognitionModule ?? null;
  } catch {
    return null;
  }
})();

const DEBOUNCE_MS = 140;
const SUGGEST_DEBOUNCE_MS = 110;
const DEFAULT_SEARCH_LANGUAGE = "en-IN";

const SORT_OPTIONS: { value: SortOption | ""; label: string }[] = [
  { value: "", label: "Default" },
  { value: "price_asc", label: "Price: Low -> High" },
  { value: "price_desc", label: "Price: High -> Low" },
  { value: "newest", label: "Newest First" },
  { value: "popularity", label: "Most Popular" },
];

type CategoryChipItem = {
  id: string;
  name: string;
};

type SpeechResultEvent = {
  results?: { transcript?: string }[];
  isFinal?: boolean;
};

type SpeechErrorEvent = {
  message?: string;
  error?: string;
};

type SpeechPermission = { granted: boolean; canAskAgain?: boolean };

type SpeechRecognitionModuleLike = {
  isRecognitionAvailable: () => boolean;
  stop: () => void;
  start: (options?: Record<string, unknown>) => void;
  requestPermissionsAsync: () => Promise<SpeechPermission>;
  getPermissionsAsync?: () => Promise<SpeechPermission>;
  addListener?: (
    eventName: string,
    listener: (event?: unknown) => void
  ) => { remove: () => void };
};

// ---------------------------------------------------------------------------
// Memoized product card (avoids re-render when list scrolls)
// ---------------------------------------------------------------------------
const ProductCard = React.memo(function ProductCard({
  item,
  onPress,
  onQuickAdd,
  onBuyNow,
  width,
}: {
  item: ProductSummary;
  onPress: (id: string) => void;
  onQuickAdd: (id: string) => void;
  onBuyNow: (id: string) => void;
  width: number;
}) {
  return (
    <MarketplaceCard
      product={item}
      onPress={onPress}
      onQuickAdd={onQuickAdd}
      onBuyNow={onBuyNow}
      style={{ width }}
      imageWidth={width}
    />
  );
});

const CategoryChip = React.memo(function CategoryChip({
  item,
  active,
  onPress,
}: {
  item: CategoryChipItem;
  active: boolean;
  onPress: (item: CategoryChipItem, active: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(item, active)}
      style={[styles.categoryChip, active && styles.categoryChipActive]}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${item.name}`}
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[styles.categoryChipText, active && styles.categoryChipTextActive]}
      >
        {item.name}
      </Text>
    </Pressable>
  );
});

export default function SearchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { width: viewportWidth } = useWindowDimensions();
  const columnCount = viewportWidth >= 900 ? 4 : viewportWidth >= 600 ? 3 : 2;
  const cardWidth = Math.max(
    148,
    (viewportWidth - spacing.lg * 2 - spacing.md * (columnCount - 1)) / columnCount
  );
  const params = useLocalSearchParams<{ q?: string; categoryId?: string }>();
  const initialSearch = typeof params.q === "string" ? params.q : "";
  const initialCategoryId =
    typeof params.categoryId === "string" ? params.categoryId : undefined;

  const [categories, setCategories] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [selectedCategory, setSelectedCategory] = React.useState<
    string | undefined
  >(initialCategoryId);
  const [search, setSearch] = React.useState(initialSearch);
  const [products, setProducts] = React.useState<ProductSummary[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<SortOption | "">("");
  const [showSortSheet, setShowSortSheet] = React.useState(false);
  const [quickBuyId, setQuickBuyId] = React.useState<string | null>(null);
  const [quickBuyIntent, setQuickBuyIntent] = React.useState<QuickBuyIntent>("cart");
  const [showCategoryFilters, setShowCategoryFilters] = React.useState(true);
  const [suggestions, setSuggestions] = React.useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [voiceSupported, setVoiceSupported] = React.useState(true);
  const [voiceListening, setVoiceListening] = React.useState(false);
  const [voiceTranscript, setVoiceTranscript] = React.useState("");
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const speechModuleRef = React.useRef<SpeechRecognitionModuleLike | null>(null);

  // Abort controller for the active search request
  const controllerRef = React.useRef<AbortController | null>(null);
  // Debounce timer
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // `search` is read through a ref so that typing does not change loadProducts'
  // identity. It used to: the "category or sort" effect below depends on
  // loadProducts, so every keystroke re-ran a full un-debounced search
  // alongside the debounced one — two requests per character.
  const searchRef = React.useRef(initialSearch);
  React.useEffect(() => {
    searchRef.current = search;
  }, [search]);
  // Suggestion debounce timer
  const suggestDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suggestion abort controller
  const suggestControllerRef = React.useRef<AbortController | null>(null);
  const speechTriggeredSearchRef = React.useRef(false);

  const skeletons = React.useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => ({
        id: `skeleton-${index}`,
        skeleton: true as const,
      })),
    []
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      speechModuleRef.current?.stop();
      controllerRef.current?.abort();
      suggestControllerRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!speechRecognitionModule) {
      speechModuleRef.current = null;
      setVoiceSupported(false);
      return;
    }

    // The module can be present while the device still has no recogniser — an
    // Android build without Google's speech services, for instance.
    let available = true;
    try {
      if (typeof speechRecognitionModule.isRecognitionAvailable === "function") {
        available = Boolean(speechRecognitionModule.isRecognitionAvailable());
      }
    } catch {
      available = false;
    }

    speechModuleRef.current = available ? speechRecognitionModule : null;
    setVoiceSupported(available);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await getCategories();
        if (!controller.signal.aborted) {
          setCategories(result.categories ?? []);
        }
      } catch (err) {
        if (!isAbortError(err)) setCategories([]);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const loadProducts = React.useCallback(
    async (
      nextPage: number,
      replace: boolean,
      overrideSearch?: string,
      signal?: AbortSignal
    ) => {
      if (replace) {
        setLoading(true);
        setFetchError(null);
      } else {
        setLoadingMore(true);
      }

      const cacheParams = {
        page: nextPage,
        limit: 10,
        categoryId: selectedCategory,
        search: overrideSearch ?? (searchRef.current.trim() || undefined),
        sort: sortBy || undefined,
      };

      const cached = await getProductsCached(cacheParams);
      const hadCache = Boolean(cached?.data?.length);
      if (cached && replace && hadCache) {
        setProducts(cached.data ?? []);
        setPage(cached.pagination?.page ?? nextPage);
        setTotalPages(cached.pagination?.totalPages ?? 1);
        setLoading(false);
      }

      try {
        const response = await getProductsAndCache({
          ...cacheParams,
          page: nextPage,
        });
        if (signal?.aborted) return;
        const nextItems = response.data ?? [];
        setProducts((prev) => (replace ? nextItems : [...prev, ...nextItems]));
        setPage(response.pagination?.page ?? nextPage);
        setTotalPages(response.pagination?.totalPages ?? 1);
      } catch (err) {
        if (isAbortError(err)) return;
        const message =
          err instanceof Error ? err.message : "Failed to load products";
        setFetchError(message);
        if (replace && !hadCache) setProducts([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [selectedCategory, sortBy]
  );

  // Load on category or sort change
  React.useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    loadProducts(1, true, undefined, controller.signal);
    return () => controller.abort();
  }, [selectedCategory, sortBy, loadProducts]);

  // Debounced search as user types
  const handleSearchChange = React.useCallback(
    (text: string) => {
      setSearch(text);

      // Cancel pending debounce + in-flight request
      if (debounceRef.current) clearTimeout(debounceRef.current);
      controllerRef.current?.abort();

      debounceRef.current = setTimeout(() => {
        const trimmed = text.trim();
        router.setParams({
          q: trimmed || undefined,
          categoryId: selectedCategory,
        });
        const controller = new AbortController();
        controllerRef.current = controller;
        loadProducts(1, true, trimmed || undefined, controller.signal);
        setShowSuggestions(false);
      }, DEBOUNCE_MS);

      // Fetch autocomplete suggestions
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
      suggestControllerRef.current?.abort();

      if (text.trim().length >= 2) {
        suggestDebounceRef.current = setTimeout(async () => {
          const ctrl = new AbortController();
          suggestControllerRef.current = ctrl;
          try {
            const items = await getSuggestions(text.trim(), 6, ctrl.signal);
            if (!ctrl.signal.aborted) {
              setSuggestions(items);
              setShowSuggestions(items.length > 0);
            }
          } catch (err) {
            if (!isAbortError(err)) {
              setSuggestions([]);
              setShowSuggestions(false);
            }
          }
        }, SUGGEST_DEBOUNCE_MS);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [loadProducts, router, selectedCategory]
  );

  const handleSelectCategory = React.useCallback((id?: string) => {
    setSelectedCategory(id);
    router.setParams({
      q: search.trim() || undefined,
      categoryId: id,
    });
  }, [router, search]);

  const handleSearch = React.useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    controllerRef.current?.abort();
    const trimmed = search.trim();
    router.setParams({
      q: trimmed || undefined,
      categoryId: selectedCategory,
    });
    const controller = new AbortController();
    controllerRef.current = controller;
    loadProducts(1, true, trimmed, controller.signal);
  }, [loadProducts, router, search, selectedCategory]);

  const runVoiceSearch = React.useCallback(
    (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      controllerRef.current?.abort();
      setSearch(trimmed);
      setShowSuggestions(false);
      setSuggestions([]);
      setVoiceError(null);
      speechTriggeredSearchRef.current = true;

      router.setParams({
        q: trimmed,
        categoryId: selectedCategory,
      });

      const controller = new AbortController();
      controllerRef.current = controller;
      loadProducts(1, true, trimmed, controller.signal);
    },
    [loadProducts, router, selectedCategory]
  );

  const stopVoiceSearch = React.useCallback(() => {
    speechModuleRef.current?.stop();
  }, []);

  const startVoiceSearch = React.useCallback(async () => {
    if (!voiceSupported) {
      showToast("Voice search is not available on this device.", "info");
      return;
    }

    speechTriggeredSearchRef.current = false;
    setVoiceError(null);
    setVoiceTranscript("");
    setShowSuggestions(false);

    try {
      const speechModule = speechModuleRef.current;
      if (!speechModule) {
        setVoiceSupported(false);
        showToast("Voice search is not available on this device.", "info");
        return;
      }

      // Ask only when we do not already hold it, so the sheet is not shown on
      // every tap; if the user has permanently denied it, the OS will not
      // re-prompt and the only route left is the Settings app.
      let permission = await speechModule.getPermissionsAsync?.();
      if (!permission?.granted) {
        permission = await speechModule.requestPermissionsAsync();
      }

      if (!permission?.granted) {
        const canAskAgain = permission?.canAskAgain !== false;
        const message = canAskAgain
          ? "Microphone permission is required for voice search."
          : "Microphone access is blocked. Enable it in Settings to use voice search.";
        setVoiceError(message);
        showToast(message, "error");
        if (!canAskAgain) {
          void Linking.openSettings().catch(() => undefined);
        }
        return;
      }

      speechModule.start({
        lang: DEFAULT_SEARCH_LANGUAGE,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        contextualStrings: categories.map((category) => category.name),
        addsPunctuation: false,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: "web_search",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start voice search";
      setVoiceError(message);
      showToast(message, "error");
    }
  }, [categories, showToast, voiceSupported]);

  const toggleVoiceSearch = React.useCallback(() => {
    if (voiceListening) {
      stopVoiceSearch();
      return;
    }

    startVoiceSearch();
  }, [startVoiceSearch, stopVoiceSearch, voiceListening]);

  React.useEffect(() => {
    const speechModule = speechModuleRef.current;
    if (!speechModule?.addListener) return;

    const onStart = speechModule.addListener("start", () => {
      setVoiceListening(true);
      setVoiceError(null);
    });

    const onEnd = speechModule.addListener("end", () => {
      setVoiceListening(false);
      if (!speechTriggeredSearchRef.current && voiceTranscript.trim()) {
        runVoiceSearch(voiceTranscript);
      }
    });

    const onResult = speechModule.addListener("result", (event?: unknown) => {
      const typedEvent = (event as SpeechResultEvent) ?? {};
      const transcript = typedEvent.results?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;

      setVoiceTranscript(transcript);
      setSearch(transcript);

      if (typedEvent.isFinal) {
        runVoiceSearch(transcript);
      }
    });

    const onError = speechModule.addListener("error", (event?: unknown) => {
      const typedEvent = (event as SpeechErrorEvent) ?? {};
      setVoiceListening(false);
      const message = typedEvent.message || "Voice search failed";
      setVoiceError(message);
      if (typedEvent.error !== "aborted") {
        showToast(message, "error");
      }
    });

    return () => {
      onStart?.remove();
      onEnd?.remove();
      onResult?.remove();
      onError?.remove();
    };
  }, [runVoiceSearch, showToast, voiceTranscript]);

  const handleRetry = React.useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    loadProducts(1, true, search.trim() || undefined, controller.signal);
  }, [loadProducts, search]);

  const handleLoadMore = React.useCallback(() => {
    if (!loadingMore && page < totalPages) {
      loadProducts(page + 1, false);
    }
  }, [loadingMore, page, totalPages, loadProducts]);

  const handleProductPress = React.useCallback(
    (id: string) => {
      prefetchProduct(queryClient, id);
      router.push({ pathname: "/product/[id]", params: { id } });
    },
    [queryClient, router]
  );

  const openQuickAdd = React.useCallback((productId: string) => {
    setQuickBuyIntent("cart");
    setQuickBuyId(productId);
  }, []);

  const openBuyNow = React.useCallback((productId: string) => {
    setQuickBuyIntent("buy");
    setQuickBuyId(productId);
  }, []);

  // Stable renderItem — no inline closures
  const renderItem = React.useCallback(
    ({
      item,
    }: {
      item: ProductSummary | { id: string; skeleton: true };
    }) => {
      if ("skeleton" in item) {
        return <SkeletonProductCard width={cardWidth} />;
      }
      return (
        <ProductCard
          item={item}
          onPress={handleProductPress}
          onQuickAdd={openQuickAdd}
          onBuyNow={openBuyNow}
          width={cardWidth}
        />
      );
    },
    [cardWidth, handleProductPress, openBuyNow, openQuickAdd]
  );

  const keyExtractor = React.useCallback(
    (item: ProductSummary | { id: string; skeleton: true }) => item.id,
    []
  );

  const categoryKeyExtractor = React.useCallback(
    (item: CategoryChipItem) => item.id,
    []
  );

  const categoryChips = React.useMemo<CategoryChipItem[]>(
    () => [{ id: "all", name: "All" }, ...categories],
    [categories]
  );

  const renderCategoryItem = React.useCallback(
    ({ item }: { item: CategoryChipItem }) => (
      <CategoryChip
        item={item}
        active={item.id === "all" ? !selectedCategory : selectedCategory === item.id}
        onPress={(pressedItem, active) =>
          handleSelectCategory(
            pressedItem.id === "all" ? undefined : active ? undefined : pressedItem.id
          )
        }
      />
    ),
    [handleSelectCategory, selectedCategory]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader variant="sub" showBack={false} showMenu showSearch={false} showCart />

      <View style={styles.topControls}>
        <View style={styles.searchRow}>
          <Pressable
            style={styles.iconControl}
            onPress={() => setShowSortSheet(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sort products"
          >
            <Icon name="swap-vertical-outline" size={18} color={colors.charcoal} />
          </Pressable>

          <TextInput
            placeholder="Search product, occasion, category..."
            placeholderTextColor={colors.brownSoft}
            value={search}
            onChangeText={handleSearchChange}
            onSubmitEditing={() => {
              setShowSuggestions(false);
              handleSearch();
            }}
            style={styles.searchInput}
          />
          <Pressable
            style={[
              styles.iconControl,
              voiceListening && styles.voiceControlActive,
              !voiceSupported && styles.iconControlDisabled,
            ]}
            onPress={toggleVoiceSearch}
            disabled={!voiceSupported}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={voiceListening ? "Stop voice search" : "Start voice search"}
            accessibilityState={{ disabled: !voiceSupported, selected: voiceListening }}
          >
            <Icon
              name={voiceListening ? "mic" : "mic-outline"}
              size={18}
              color={voiceListening ? colors.background : colors.charcoal}
            />
          </Pressable>
          <Pressable
            style={styles.searchButton}
            onPress={handleSearch}
            accessibilityRole="button"
            accessibilityLabel="Search products"
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>

          <Pressable
            style={[styles.iconControl, showCategoryFilters && styles.iconControlActive]}
            onPress={() => setShowCategoryFilters((prev) => !prev)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showCategoryFilters ? "Hide category filters" : "Show category filters"}
            accessibilityState={{ expanded: showCategoryFilters }}
          >
            <Icon name="funnel-outline" size={18} color={colors.charcoal} />
          </Pressable>
        </View>

        {voiceListening ? (
          <Text style={styles.voiceStatusText}>
            Listening{voiceTranscript ? `: ${voiceTranscript}` : "..."}
          </Text>
        ) : voiceError ? (
          <Text style={styles.voiceErrorText}>{voiceError}</Text>
        ) : voiceSupported ? (
          <Text style={styles.voiceHintText}>Tap the mic and speak your search.</Text>
        ) : (
          <Text style={styles.voiceHintText}>Voice search is not available on this device.</Text>
        )}

        {showCategoryFilters ? (
          <FlatList
            data={categoryChips}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={categoryKeyExtractor}
            contentContainerStyle={styles.categoryRow}
            renderItem={renderCategoryItem}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={3}
            updateCellsBatchingPeriod={24}
            removeClippedSubviews
          />
        ) : null}
      </View>

      {/* Autocomplete suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((item) => (
            <Pressable
              key={item.id}
              style={styles.suggestionItem}
              accessibilityRole="button"
              accessibilityLabel={`Search for ${item.title}`}
              onPress={() => {
                setSearch(item.title);
                setShowSuggestions(false);
                setSuggestions([]);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                controllerRef.current?.abort();
                const controller = new AbortController();
                controllerRef.current = controller;
                router.setParams({ q: item.title, categoryId: selectedCategory });
                loadProducts(1, true, item.title, controller.signal);
              }}
            >
              <Text style={styles.suggestionTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.category ? (
                <Text style={styles.suggestionCategory}>{item.category}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      {/* Sort bottom sheet */}
      <Modal
        visible={showSortSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortSheet(false)}
      >
        <View style={styles.sortOverlay} accessibilityViewIsModal>
          <Pressable
            style={styles.sortBackdrop}
            onPress={() => setShowSortSheet(false)}
            accessibilityRole="button"
            accessibilityLabel="Close sort options"
          />
          <View style={styles.sortSheet}>
            <Text style={styles.sortSheetTitle}>Sort By</Text>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.sortSheetOption,
                  sortBy === opt.value && styles.sortSheetOptionActive,
                ]}
                onPress={() => {
                  setSortBy(opt.value as SortOption | "");
                  setShowSortSheet(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: sortBy === opt.value }}
              >
                <Text
                  style={[
                    styles.sortSheetOptionText,
                    sortBy === opt.value && styles.sortSheetOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {fetchError && !loading && products.length === 0 ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load products</Text>
          <Text style={styles.errorMessage}>{fetchError}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading products"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlashList
        key={`search-grid-${columnCount}`}
        data={
          (loading ? skeletons : products) as (
            ProductSummary | { id: string; skeleton: true }
          )[]
        }
        keyExtractor={keyExtractor}
        numColumns={columnCount}
        drawDistance={Math.round(cardWidth * 3)}
        renderItem={renderItem}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          !loading && !fetchError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No products found.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreWrap}>
              <BrandLoader size="sm" color={colors.gold} />
            </View>
          ) : null
        }
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
  topControls: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    ...shadow.card,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.charcoal,
  },
  searchButton: {
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  searchButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.background,
  },
  iconControl: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  iconControlActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(184, 149, 108, 0.14)",
  },
  iconControlDisabled: {
    opacity: 0.45,
  },
  voiceControlActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  voiceHintText: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
  },
  voiceStatusText: {
    marginTop: spacing.sm,
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.gold,
  },
  voiceErrorText: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 11,
    color: "#B42318",
  },
  categoryRow: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    minHeight: 44,
    justifyContent: "center",
  },
  categoryChipActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(184, 149, 108, 0.14)",
  },
  categoryChipText: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brown,
  },
  categoryChipTextActive: {
    color: colors.charcoal,
  },
  gridContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  gridRow: {
    gap: spacing.md,
  },
  skeletonLine: {
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: colors.cream,
    marginTop: spacing.sm,
  },
  skeletonLineShort: {
    height: 12,
    width: "60%",
    borderRadius: radius.xs,
    backgroundColor: colors.cream,
    marginTop: spacing.xs,
  },
  emptyState: {
    paddingTop: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },
  errorCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    ...shadow.card,
  },
  errorTitle: {
    fontFamily: typography.serif,
    fontSize: 16,
    color: colors.charcoal,
  },
  errorMessage: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: "center",
  },
  retryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.background,
  },
  loadingMoreWrap: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  suggestionsContainer: {
    marginTop: spacing.xs,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    ...shadow.card,
    maxHeight: 220,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    minHeight: 44,
  },
  suggestionTitle: {
    flex: 1,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.charcoal,
  },
  suggestionCategory: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: spacing.sm,
  },
  sortOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sortBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sortSheet: {
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sortSheetTitle: {
    fontFamily: typography.serif,
    fontSize: 18,
    color: colors.charcoal,
    marginBottom: spacing.md,
  },
  sortSheetOption: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    minHeight: 44,
    justifyContent: "center",
  },
  sortSheetOptionActive: {
    backgroundColor: "rgba(184, 149, 108, 0.14)",
    borderRadius: radius.xl,
  },
  sortSheetOptionText: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.charcoal,
  },
  sortSheetOptionTextActive: {
    fontFamily: typography.sansMedium,
    color: colors.charcoal,
  },
});
