import * as React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather, Ionicons } from "@expo/vector-icons";
import { CachedImage } from "../../components/CachedImage";
import { C, FILL, S } from "../theme";
import { EmptyState, PrimaryBtn, PriceLockBadge, ProductCard, ScreenHeader, T } from "../kit";
import { ProductFeedList } from "../ProductFeedList";
import { useFreeDelivery, type FeedProduct } from "../data";
import { getSaleEvent, getStore, listOccasions } from "../../services/extras";
import { useT } from "../../i18n";

/* ── Shop (Meesho "View Shop") ─────────────────────────────────────────── */

export function ShopScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const t = useT();
  const q = useQuery({ queryKey: ["storefront", "store", slug], queryFn: ({ signal }) => getStore(slug, signal), staleTime: 5 * 60 * 1000 });
  const store = q.data;

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Shop" />
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (!store) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Shop" />
        <EmptyState title="Shop not found" text="This shop may have closed." action={<PrimaryBtn label="Continue shopping" onPress={() => router.replace("/home")} style={{ marginTop: 10 }} />} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title={store.name} />
      <ProductFeedList
        sellerId={store.sellerId}
        title="Products from this shop"
        header={
          <View style={styles.shopHead}>
            <View style={styles.logo}>
              {store.logo ? <CachedImage source={store.logo} style={FILL} contentFit="cover" /> : <T w="bold" size={24} color={C.brandDark}>{store.name.charAt(0)}</T>}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T w="semibold" size={16} numberOfLines={2}>{store.name}</T>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                {store.rating.count > 0 && store.rating.average != null ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={styles.rating}>
                      <T w="bold" size={11} color={C.white}>{store.rating.average.toFixed(1)}</T>
                      <Ionicons name="star" size={9} color={C.white} />
                    </View>
                    <T size={11} color={C.muted}>{store.rating.count} {t(store.rating.count === 1 ? "rating" : "ratings")}</T>
                  </View>
                ) : (
                  <T size={11} color={C.muted}>New shop</T>
                )}
                <T size={11} color={C.muted}>{store.productCount} {t("products")}</T>
                {store.city ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Feather name="map-pin" size={11} color={C.muted} />
                    <T size={11} color={C.muted}>{store.city}</T>
                  </View>
                ) : null}
              </View>
              {store.onHoliday ? <T size={11} color={C.brandDark} style={{ marginTop: 4 }}>This shop is on a short holiday.</T> : null}
            </View>
          </View>
        }
      />
    </View>
  );
}

/* ── KTMONA Price Lock ─────────────────────────────────────────────────── */

export function PriceLockScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="KTMONA Price Lock" />
      <ProductFeedList
        priceLock
        title={null}
        header={
          <View style={styles.lockHero}>
            <PriceLockBadge />
            <T w="bold" size={20} color={C.white} style={{ marginTop: 8 }}>The lowest price in the market, locked in.</T>
            {[
              "Sellers promise their lowest market price",
              "Every product checked by the KTMONA team",
              "Badge removed automatically if the price goes up",
            ].map((line) => (
              <View key={line} style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <Feather name="check" size={13} color={C.brand} />
                <T size={12} color="#D7DCEB" style={{ marginLeft: 6 }}>{line}</T>
              </View>
            ))}
          </View>
        }
      />
    </View>
  );
}

/* ── Curated collection (website "occasion" pages) ─────────────────────── */

export function CollectionScreen({ slug }: { slug: string }) {
  const q = useQuery({ queryKey: ["storefront", "occasions"], queryFn: ({ signal }) => listOccasions(signal), staleTime: 30 * 60 * 1000 });
  const occasion = q.data?.find((o) => o.slug === slug);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title={occasion?.name ?? "Collection"} />
      <ProductFeedList
        occasion={slug}
        title={null}
        header={
          occasion?.image ? (
            <CachedImage source={occasion.image} style={{ width: "100%", aspectRatio: 2.2 }} contentFit="cover" />
          ) : occasion?.description ? (
            <View style={{ backgroundColor: C.card, padding: 12 }}><T size={13} color={C.textSoft}>{occasion.description}</T></View>
          ) : null
        }
      />
    </View>
  );
}

/* ── Sale event ─────────────────────────────────────────────────────────── */

export function SaleScreen({ slug }: { slug: string }) {
  const { width } = useWindowDimensions();
  const t = useT();
  const freeDelivery = useFreeDelivery();
  const cardW = Math.floor((width - S.page * 2 - S.gap) / 2);
  const q = useQuery({ queryKey: ["storefront", "sale", slug], queryFn: ({ signal }) => getSaleEvent(slug, signal), staleTime: 2 * 60 * 1000 });
  const sale = q.data;

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Sale" />
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (!sale) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Sale" />
        <EmptyState title="This sale has ended" />
      </View>
    );
  }

  const products: FeedProduct[] = sale.products.map((p) => ({
    id: p.id,
    title: p.title,
    images: p.images,
    price: p.price,
    regularPrice: p.compareAtPrice,
    category: p.category ?? null,
  }));
  const ends = new Date(sale.campaign.endsAt);
  const starts = new Date(sale.campaign.startsAt);
  const upcoming = starts > new Date();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title={sale.campaign.name} />
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: S.gap, paddingHorizontal: S.page }}
        contentContainerStyle={{ gap: S.gap, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 4 }}>
            {sale.campaign.bannerImage ? <CachedImage source={sale.campaign.bannerImage} style={{ width: "100%", aspectRatio: 2.2 }} contentFit="cover" /> : null}
            <View style={{ backgroundColor: C.card, padding: 12 }}>
              {sale.campaign.description ? <T size={13} color={C.textSoft}>{sale.campaign.description}</T> : null}
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <Feather name="clock" size={13} color={C.brandDark} />
                <T w="semibold" size={12} color={C.brandDark} style={{ marginLeft: 5 }}>
                  {upcoming
                    ? `${t("Starts")} ${starts.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : `${t("Ends")} ${ends.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                </T>
                {sale.campaign.minDiscountPercent ? (
                  <T w="semibold" size={12} color={C.green} style={{ marginLeft: 12 }}>{t("Min. {pct}% off", { pct: sale.campaign.minDiscountPercent })}</T>
                ) : null}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState title="Products are being added" text="Check back soon." />}
        renderItem={({ item }) => <ProductCard product={item} freeDelivery={freeDelivery} width={cardW} />}
      />
    </View>
  );
}

/* ── Small home entry for Price Lock ───────────────────────────────────── */

export function PriceLockBand() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/price-lock" as never)} style={styles.band}>
      <View style={styles.bandIcon}><Feather name="lock" size={20} color={C.navy} /></View>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <T w="bold" size={10} color={C.brand} style={{ letterSpacing: 1.5 }}>KTMONA PRICE LOCK</T>
        <T w="semibold" size={14} color={C.white} numberOfLines={2}>Lowest price in the market, locked in</T>
      </View>
      <Feather name="chevron-right" size={20} color={C.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shopHead: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, padding: 14 },
  logo: { width: 60, height: 60, borderRadius: 14, backgroundColor: C.brandSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  rating: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: C.greenBadge, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  lockHero: { backgroundColor: C.navy, padding: 16 },
  band: { flexDirection: "row", alignItems: "center", backgroundColor: C.navy, marginHorizontal: S.page, marginTop: 10, borderRadius: 12, padding: 14 },
  bandIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
});
