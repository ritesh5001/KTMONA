import * as React from "react";
import { ActivityIndicator, FlatList, RefreshControl, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useWishlist } from "../../providers/WishlistProvider";
import { C, S } from "../theme";
import { EmptyState, PrimaryBtn, ProductCard, ScreenHeader } from "../kit";
import { useFreeDelivery, type FeedProduct } from "../data";

/** Wishlist as a Meesho-style product grid; the heart on each card removes it. */
export default function WishlistScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { wishlistItems, isLoading, refreshWishlist } = useWishlist();
  const freeDelivery = useFreeDelivery();
  const [refreshing, setRefreshing] = React.useState(false);
  const cardW = Math.floor((width - S.page * 2 - S.gap) / 2);

  const products: FeedProduct[] = React.useMemo(
    () =>
      wishlistItems.map((w) => {
        const price = w.product.salePrice ?? w.product.adminPrice ?? w.product.adminListingPrice ?? w.product.price ?? null;
        return { id: w.productId, title: w.product.title, images: w.product.images, price, salePrice: price, regularPrice: w.product.regularPrice ?? null };
      }),
    [wishlistItems],
  );

  const subtitle = products.length ? `${products.length} ${products.length === 1 ? "item" : "items"}` : undefined;

  if (!session?.accessToken) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="My Wishlist" />
        <EmptyState title="Sign in to see your wishlist" text="Save products you love and find them here on any device." action={<PrimaryBtn label="Sign Up / Log In" onPress={() => router.push("/login?returnTo=%2Fwishlist")} style={{ marginTop: 10, minWidth: 180 }} />} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="My Wishlist" subtitle={subtitle} />
      {isLoading && !products.length ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: S.gap, paddingHorizontal: S.page }}
          contentContainerStyle={{ gap: S.gap, paddingTop: S.gap, paddingBottom: 30 }}
          renderItem={({ item }) => <ProductCard product={item} freeDelivery={freeDelivery} width={cardW} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refreshWishlist(); setRefreshing(false); }} tintColor={C.brand} />}
          ListEmptyComponent={<EmptyState title="Your wishlist is empty" text="Tap the heart on any product to save it here." action={<PrimaryBtn label="Start shopping" onPress={() => router.push("/home")} style={{ marginTop: 10, minWidth: 160 }} />} />}
        />
      )}
    </View>
  );
}
