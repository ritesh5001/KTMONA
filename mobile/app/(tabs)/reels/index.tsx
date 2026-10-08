import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AppText as Text } from "../../../src/components";
import { ReelItem, type ReelFeedItem } from "../../../src/components/ReelItem";
import { listPublicReels } from "../../../src/services/reels";
import { prefetchProduct } from "../../../src/lib/prefetch-product";
import { impactLight } from "../../../src/utils/haptics";
import { colors, spacing, radius } from "../../../src/theme";

const REELS_PAGE_LIMIT = 8;

export default function ReelsScreen() {
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const { width, height } = useWindowDimensions();
  const [visibleIndex, setVisibleIndex] = React.useState(0);
  const [likedById, setLikedById] = React.useState<Record<string, boolean>>({});
  const [likeCountsById, setLikeCountsById] = React.useState<Record<string, number>>({});
  const [isMuted, setIsMuted] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<"MENS" | "KIDS">("MENS");
  const listRef = React.useRef<FlashListRef<ReelFeedItem> | null>(null);
  const visibleIndexRef = React.useRef(0);
  const dragStartIndexRef = React.useRef(0);
  const isSettlingRef = React.useRef(false);

  const reelsQuery = useInfiniteQuery({
    queryKey: ["reels-feed", REELS_PAGE_LIMIT, activeCategory],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listPublicReels({ page: pageParam, limit: REELS_PAGE_LIMIT, category: activeCategory }),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });

  const reels = React.useMemo<ReelFeedItem[]>(() => {
    const pages = reelsQuery.data?.pages ?? [];
    return pages.flatMap((page) =>
      (page.reels ?? []).map((reel) => ({
        id: reel.id,
        videoUrl: reel.videoUrl,
        thumbnailUrl: reel.thumbnailUrl ?? reel.product?.images?.[0] ?? null,
        caption: reel.caption?.trim() || "",
        username: "@ktmona",
        productId: reel.productId ?? null,
        likeCount: reel.likes ?? 0,
        productTitle: reel.product?.title?.trim() || null,
      }))
    );
  }, [reelsQuery.data]);

  const itemHeight = height;
  const itemWidth = width;

  React.useEffect(() => {
    visibleIndexRef.current = visibleIndex;
  }, [visibleIndex]);

  React.useEffect(() => {
    setVisibleIndex(0);
    visibleIndexRef.current = 0;
    dragStartIndexRef.current = 0;
    setLikedById({});
    setLikeCountsById({});
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeCategory]);

  React.useEffect(() => {
    setLikeCountsById((prev) => {
      let changed = false;
      const next = { ...prev };
      reels.forEach((reel) => {
        if (next[reel.id] === undefined) {
          next[reel.id] = reel.likeCount;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [reels]);

  const viewabilityConfigRef = React.useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 120,
  });

  const onViewableItemsChanged = React.useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    if (isSettlingRef.current) return;
    const firstVisible = viewableItems.find((entry) => typeof entry.index === "number");
    const nextIndex = firstVisible?.index;
    if (typeof nextIndex === "number") {
      setVisibleIndex((prev) => (prev === nextIndex ? prev : nextIndex));
    }
  }).current;

  const settleToSingleReel = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (reels.length === 0 || itemHeight <= 0) return;

      const rawIndex = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
      const startIndex = dragStartIndexRef.current;
      const direction = rawIndex > startIndex ? 1 : rawIndex < startIndex ? -1 : 0;
      const targetIndex = Math.min(
        Math.max(startIndex + direction, 0),
        reels.length - 1
      );

      if (targetIndex === visibleIndexRef.current) {
        return;
      }

      isSettlingRef.current = true;
      visibleIndexRef.current = targetIndex;
      setVisibleIndex(targetIndex);
      listRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
        viewPosition: 0,
      });
      requestAnimationFrame(() => {
        isSettlingRef.current = false;
      });
    },
    [itemHeight, reels.length]
  );

  const handleScrollBeginDrag = React.useCallback(() => {
    dragStartIndexRef.current = visibleIndexRef.current;
  }, []);

  const loadMore = React.useCallback(() => {
    if (reelsQuery.hasNextPage && !reelsQuery.isFetchingNextPage) {
      void reelsQuery.fetchNextPage();
    }
  }, [reelsQuery]);

  const toggleLike = React.useCallback((id: string) => {
    impactLight();
    setLikedById((prev) => {
      const nextLiked = !prev[id];
      const currentReelCount = reels.find((reel) => reel.id === id)?.likeCount ?? 0;
      setLikeCountsById((counts) => ({
        ...counts,
        [id]: Math.max(0, (counts[id] ?? currentReelCount) + (nextLiked ? 1 : -1)),
      }));
      return { ...prev, [id]: nextLiked };
    });
  }, [reels]);

  const toggleMute = React.useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  React.useEffect(() => {
    if (!isScreenFocused) {
      setIsMuted(true);
    }
  }, [isScreenFocused]);

  const shareReel = React.useCallback((_item: ReelFeedItem) => {
    Alert.alert(
      "Download KTMONA app",
      "Is reel ko open karne ke liye KTMONA app download karein.",
      [{ text: "OK" }]
    );
  }, []);

  const handlePressProduct = React.useCallback(
    (id: string) => {
      prefetchProduct(queryClient, id);
      router.push(`/product/${id}` as any);
    },
    [queryClient, router]
  );

  const renderReel = React.useCallback(
    ({ item, index }: { item: ReelFeedItem; index: number }) => (
      <ReelItem
        item={item}
        width={itemWidth}
        height={itemHeight}
        tabBarHeight={tabBarHeight}
        isActive={isScreenFocused && index === visibleIndex}
        isMuted={isMuted || !isScreenFocused}
        shouldPreload={index === visibleIndex + 1}
        shouldKeepInMemory={Math.abs(index - visibleIndex) <= 1}
        liked={likedById[item.id] ?? false}
        likeCount={likeCountsById[item.id] ?? item.likeCount}
        onToggleMute={toggleMute}
        onToggleLike={toggleLike}
        onShare={shareReel}
        onPressProduct={handlePressProduct}
      />
    ),
    [handlePressProduct, isMuted, isScreenFocused, itemHeight, itemWidth, likeCountsById, likedById, shareReel, tabBarHeight, toggleLike, toggleMute, visibleIndex]
  );

  const renderCategorySwitcher = () => (
    <View style={styles.switcherContainer}>
      <Pressable
        style={[styles.switcherTab, activeCategory === "MENS" && styles.switcherTabActive]}
        onPress={() => setActiveCategory("MENS")}
      >
        <Text style={[styles.switcherText, activeCategory === "MENS" && styles.switcherTextActive]}>Mens</Text>
      </Pressable>
      <Pressable
        style={[styles.switcherTab, activeCategory === "KIDS" && styles.switcherTabActive]}
        onPress={() => setActiveCategory("KIDS")}
      >
        <Text style={[styles.switcherText, activeCategory === "KIDS" && styles.switcherTextActive]}>Kids</Text>
      </Pressable>
    </View>
  );

  if (reelsQuery.isLoading) {
    return (
      <View style={styles.stateWrap}>
        {renderCategorySwitcher()}
        <ActivityIndicator size="large" color={colors.primaryAccent} />
        <Text style={styles.stateText}>Loading reels...</Text>
      </View>
    );
  }

  if (reelsQuery.isError || reels.length === 0) {
    return (
      <View style={styles.stateWrap}>
        {renderCategorySwitcher()}
        <Text style={styles.stateText}>No reels available right now.</Text>
        <Pressable style={styles.retryButton} onPress={() => reelsQuery.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderCategorySwitcher()}
      <FlashList
        ref={listRef}
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={renderReel}
        pagingEnabled
        disableIntervalMomentum
        snapToAlignment="start"
        snapToInterval={itemHeight}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        drawDistance={itemHeight * 1.5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfigRef.current}
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={settleToSingleReel}
        onScrollEndDrag={settleToSingleReel}
        onEndReached={loadMore}
        onEndReachedThreshold={0.65}
        ListFooterComponent={
          reelsQuery.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.primaryAccent} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  stateWrap: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  stateText: {
    color: "#FFFFFF",
    fontSize: 13,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.primaryAccent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(255, 138, 0, 0.15)",
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  footerLoader: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
  switcherContainer: {
    position: "absolute",
    top: 60,
    zIndex: 40,
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 4,
  },
  switcherTab: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
  },
  switcherTabActive: {
    backgroundColor: "#FFFFFF",
  },
  switcherText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
  switcherTextActive: {
    color: "#000000",
  },
});
