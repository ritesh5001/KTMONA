import * as React from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "../../src/components/AppHeader";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../src/components";
import { getCategories } from "../../src/services/catalog";
import { colors, radius, spacing, typography, shadow } from "../../src/theme/tokens";
import { CachedImage } from "../../src/components/CachedImage";
import { SkeletonBlock } from "../../src/components/Skeleton";
import { Icon } from "../../src/components/Icon";
import { images } from "../../src/data/images";

export default function CategoriesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columnCount = width >= 768 ? 3 : 2;
  const cardWidth = Math.floor(
    (width - spacing.lg * 2 - spacing.md * (columnCount - 1)) / columnCount
  );
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    staleTime: 10 * 60 * 1000,
  });
  const categories = categoriesQuery.data?.categories ?? [];

  const openCategory = React.useCallback(
    (categoryId: string, categoryName: string) => {
      router.push({
        pathname: "/search",
        params: { categoryId, q: categoryName },
      });
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title="Categories" subtitle="Shop every collection" showBack />
      {categoriesQuery.isLoading ? (
        <View style={styles.loadingGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonBlock
              key={`category-skeleton-${index}`}
              width={cardWidth}
              height={Math.round(cardWidth * 1.25)}
              borderRadius={radius.lg}
            />
          ))}
        </View>
      ) : categoriesQuery.isError ? (
        <View style={styles.state}>
          <Icon name="alert-circle-outline" size={30} color={colors.brownSoft} />
          <Text style={styles.stateTitle}>Collections are unavailable</Text>
          <Text style={styles.stateCopy}>Check your connection and try again.</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void categoriesQuery.refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading categories"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.state}>
          <Icon name="grid" size={30} color={colors.brownSoft} />
          <Text style={styles.stateTitle}>No collections yet</Text>
          <Text style={styles.stateCopy}>New edits will appear here when available.</Text>
        </View>
      ) : (
        <FlatList
          key={`categories-${columnCount}`}
          data={categories}
          numColumns={columnCount}
          keyExtractor={(category) => category.id}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.intro}>
              Explore curated weddingwear and occasion-ready edits.
            </Text>
          }
          renderItem={({ item: category, index }) => (
            <Pressable
              style={[styles.card, { width: cardWidth }]}
              onPress={() => openCategory(category.id, category.name)}
              accessibilityRole="button"
              accessibilityLabel={`Shop ${category.name}`}
            >
              <CachedImage
                source={
                  category.image?.trim() ||
                  images.hero.mobile[index % images.hero.mobile.length]
                }
                style={styles.cardImage}
                contentFit="cover"
              />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {category.name}
                </Text>
                <View style={styles.cardAction}>
                  <Text style={styles.cardMeta}>Explore</Text>
                  <Icon name="arrow-right" size={14} color={colors.interactive} />
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    fontFamily: typography.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.brownSoft,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  loadingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.lg,
  },
  card: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.warmWhite,
    overflow: "hidden",
    ...shadow.card,
  },
  cardImage: {
    width: "100%",
    aspectRatio: 4 / 5,
    backgroundColor: colors.surface,
  },
  cardBody: {
    padding: spacing.md,
  },
  cardTitle: {
    fontFamily: typography.serif,
    fontSize: 19,
    lineHeight: 23,
    color: colors.charcoal,
  },
  cardAction: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  cardMeta: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.interactive,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    marginTop: spacing.md,
    fontFamily: typography.serif,
    fontSize: 22,
    color: colors.charcoal,
    textAlign: "center",
  },
  stateCopy: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.brownSoft,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 46,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.interactive,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.onAccent,
  },
});
