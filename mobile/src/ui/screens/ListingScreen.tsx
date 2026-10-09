import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { C, S } from "../theme";
import { CategoryArt, EmptyState, PrimaryBtn, ScreenHeader, T } from "../kit";
import { ProductFeedList } from "../ProductFeedList";
import { findBySlug, useCategoryTree } from "../data";

/**
 * Meesho-style listing: header with the category name, subcategory chips,
 * then the product grid with Sort | Category | Filters.
 * Without a slug it lists every product ("Shop all").
 */
export default function ListingScreen({ slug }: { slug?: string }) {
  const router = useRouter();
  const { tree, isLoading } = useCategoryTree();
  const hit = slug ? findBySlug(tree, slug) : null;

  if (slug && isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Loading…" />
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (slug && !hit) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Category" />
        <EmptyState title="Category not found" text="It may have been renamed or removed." action={<PrimaryBtn label="Browse categories" onPress={() => router.replace("/categories")} style={{ marginTop: 10 }} />} />
      </View>
    );
  }

  const node = hit?.node;
  const main = hit?.path[0];
  const parent = hit && hit.path.length > 1 ? hit.path[hit.path.length - 2] : undefined;
  const chips = node ? node.children : tree;
  // Leaves list their siblings in the Category sheet; others list children.
  const sheetCategories = node ? (node.children.length ? node.children : parent?.children.filter((c) => c.id !== node.id) ?? []) : tree;
  const subtitle = hit && hit.path.length > 1 ? hit.path.slice(0, -1).map((p) => p.name).join(" › ") : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title={node?.name ?? "All Products"} subtitle={subtitle} />
      <ProductFeedList
        categoryId={node?.id}
        categories={sheetCategories}
        title={null}
        header={
          chips.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: C.card }} contentContainerStyle={{ paddingHorizontal: S.page, paddingVertical: 12, gap: 12 }}>
              {chips.map((c) => (
                <Pressable key={c.id} onPress={() => router.push(`/category/${c.slug}`)} style={styles.chip}>
                  <CategoryArt slug={c.slug} name={c.name} image={c.image} fallbackSlug={[node?.slug, main?.slug].filter((x): x is string => Boolean(x))} style={styles.chipIcon} />
                  <T size={11} w="medium" numberOfLines={2} style={{ textAlign: "center", marginTop: 5 }}>{c.name}</T>
                </Pressable>
              ))}
            </ScrollView>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { width: 70, alignItems: "center" },
  chipIcon: { width: 58, height: 58, borderRadius: 29 },
});
