import * as React from "react";
import { ActivityIndicator, FlatList, RefreshControl, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { getRecommendations } from "../../services/personalization";
import { C, S } from "../theme";
import { EmptyState, PrimaryBtn, ProductCard, ScreenHeader } from "../kit";
import { useFreeDelivery, type FeedProduct } from "../data";

/** "Recommended for you" as a product grid (Account → Recommended For You). */
export default function RecommendedScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const freeDelivery = useFreeDelivery();
  const [products, setProducts] = React.useState<FeedProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const cardW = Math.floor((width - S.page * 2 - S.gap) / 2);
  const signedIn = Boolean(session?.accessToken);

  const load = React.useCallback(async () => {
    try {
      const recs = await getRecommendations();
      setProducts(
        recs.map((p) => {
          const price = p.adminListingPrice ?? p.sellerPrice ?? null;
          return { id: p.id, title: p.title, images: p.images, category: p.category, price, salePrice: price };
        }),
      );
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (signedIn) void load();
    else setLoading(false);
  }, [signedIn, load]);

  if (!signedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Recommended For You" />
        <EmptyState title="Sign in to see recommendations" text="We pick products for you from your wishlist, orders and browsing." action={<PrimaryBtn label="Sign Up / Log In" onPress={() => router.push("/login?returnTo=%2Faccount%2Frecommended")} style={{ marginTop: 10, minWidth: 180 }} />} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Recommended For You" />
      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: S.gap, paddingHorizontal: S.page }}
          contentContainerStyle={{ gap: S.gap, paddingTop: S.gap, paddingBottom: 30 }}
          renderItem={({ item }) => <ProductCard product={item} freeDelivery={freeDelivery} width={cardW} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.brand} />}
          ListEmptyComponent={
            failed ? (
              <EmptyState title="Couldn't load recommendations" action={<PrimaryBtn label="Retry" onPress={() => { setLoading(true); void load(); }} style={{ marginTop: 10, minWidth: 140 }} />} />
            ) : (
              <EmptyState title="No recommendations yet" text="Browse a few products and we'll pick more for you." action={<PrimaryBtn label="Start shopping" onPress={() => router.push("/home")} style={{ marginTop: 10, minWidth: 160 }} />} />
            )
          }
        />
      )}
    </View>
  );
}
