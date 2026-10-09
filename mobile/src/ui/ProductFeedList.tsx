import * as React from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { C, S } from "./theme";
import { EmptyState, PrimaryBtn, ProductCard, ProductCardSkeleton, RadioRow, Sheet, SortFilterBar, T } from "./kit";
import { PRICE_BUCKETS, SORT_OPTIONS, useFreeDelivery, useProductFeed, type CategoryNode, type FeedFilters, type FeedProduct, type SortKey } from "./data";

/**
 * Two-column product grid with Meesho's sticky Sort | Category | Filters bar.
 * The bar sticks under the screen header once the list header scrolls away.
 */
export function ProductFeedList({
  header,
  categoryId,
  search,
  categories,
  title = "Products For You",
}: {
  header?: React.ReactElement | null;
  categoryId?: string;
  search?: string;
  /** Offered in the Category sheet; tapping one opens that category. */
  categories?: CategoryNode[];
  title?: string | null;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardW = Math.floor((width - S.page * 2 - S.gap) / 2);
  const [sort, setSort] = React.useState<SortKey>("relevance");
  const [priceKey, setPriceKey] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<null | "sort" | "category" | "filter">(null);
  const filters: FeedFilters = { categoryId, search, sort, priceKey };
  const feed = useProductFeed(filters);
  const freeDelivery = useFreeDelivery();

  const sortLabel = sort === "relevance" ? undefined : SORT_OPTIONS.find((o) => o.key === sort)?.label;

  type Row = { key: string; items: (FeedProduct | null)[] };
  const rows: Row[] = React.useMemo(() => {
    if (feed.isLoading) return Array.from({ length: 3 }, (_, i) => ({ key: `sk${i}`, items: [null, null] }));
    const out: Row[] = [];
    for (let i = 0; i < feed.products.length; i += 2) out.push({ key: feed.products[i]!.id, items: feed.products.slice(i, i + 2) });
    return out;
  }, [feed.products, feed.isLoading]);

  const listHeader = (
    <View>
      {header}
      {title ? (
        <View style={{ paddingHorizontal: S.page, paddingTop: 14, paddingBottom: 8, backgroundColor: C.bg }}>
          <T w="semibold" size={17}>{title}</T>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        ListHeaderComponent={
          <>
            {listHeader}
            <SortFilterBar
              sortLabel={sortLabel}
              onSort={() => setSheet("sort")}
              onCategory={categories && categories.length ? () => setSheet("category") : undefined}
              onFilter={() => setSheet("filter")}
              activeFilters={priceKey ? 1 : 0}
            />
            {!feed.isLoading ? (
              <T size={12} color={C.muted} style={{ paddingHorizontal: S.page, paddingTop: 8 }}>
                {feed.total.toLocaleString("en-IN")} {feed.total === 1 ? "product" : "products"}
              </T>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", gap: S.gap, paddingHorizontal: S.page, marginTop: S.gap }}>
            {item.items.map((p, i) =>
              p ? <ProductCard key={p.id} product={p} freeDelivery={freeDelivery} width={cardW} /> : <ProductCardSkeleton key={i} width={cardW} />,
            )}
          </View>
        )}
        ListEmptyComponent={
          feed.isError ? (
            <EmptyState title="Couldn't load products" text="Check your connection and try again." action={<PrimaryBtn label="Retry" onPress={() => void feed.refetch()} style={{ marginTop: 10, minWidth: 140 }} />} />
          ) : (
            <EmptyState
              title="No products here yet"
              text={priceKey ? "Try another price range." : "Sellers are adding products. Check back soon."}
              action={priceKey ? <PrimaryBtn label="Clear filter" variant="outline" onPress={() => setPriceKey(null)} style={{ marginTop: 10, minWidth: 140 }} /> : undefined}
            />
          )
        }
        ListFooterComponent={feed.isFetchingMore ? <ActivityIndicator color={C.brand} style={{ marginVertical: 20 }} /> : <View style={{ height: 24 }} />}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} tintColor={C.brand} />}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
      />

      <Sheet open={sheet === "sort"} title="Sort by" onClose={() => setSheet(null)}>
        {SORT_OPTIONS.map((o) => (
          <RadioRow key={o.key} label={o.label} selected={sort === o.key} onPress={() => { setSort(o.key); setSheet(null); }} />
        ))}
      </Sheet>

      <Sheet open={sheet === "category"} title="Category" onClose={() => setSheet(null)}>
        <ScrollView>
          {(categories ?? []).map((c) => (
            <Pressable
              key={c.id}
              onPress={() => { setSheet(null); router.push(`/category/${c.slug}`); }}
              style={styles.catRow}
            >
              <T size={14}>{c.name}</T>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>

      <Sheet open={sheet === "filter"} title="Filters" onClose={() => setSheet(null)}>
        <T w="semibold" size={13} color={C.muted} style={{ paddingHorizontal: 16, paddingTop: 12 }}>PRICE</T>
        {PRICE_BUCKETS.map((p) => (
          <RadioRow key={p.key} label={p.label} selected={priceKey === p.key} onPress={() => setPriceKey(priceKey === p.key ? null : p.key)} />
        ))}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 8 }}>
          <PrimaryBtn label="Clear" variant="outline" onPress={() => setPriceKey(null)} style={{ flex: 1 }} />
          <PrimaryBtn label="Show products" onPress={() => setSheet(null)} style={{ flex: 1 }} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  catRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
});
