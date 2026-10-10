import * as React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { CachedImage } from "../components/CachedImage";
import { C, FILL, S, inr } from "./theme";
import { T } from "./kit";
import { useSavedProducts } from "../lib/local-lists";
import { getBestsellers } from "../services/bestsellers";
import { listOccasions, listSaleEvents } from "../services/extras";
import { useT } from "../i18n";

/** A titled horizontal strip of small product tiles. */
function Strip({ title, action, items }: { title: string; action?: { label: string; href: string }; items: { id: string; title: string; image: string | null; price: number | null }[] }) {
  const router = useRouter();
  if (!items.length) return null;
  return (
    <View style={{ backgroundColor: C.card, marginTop: 10, paddingVertical: 12 }}>
      <View style={styles.head}>
        <T w="semibold" size={16}>{title}</T>
        {action ? (
          <Pressable onPress={() => router.push(action.href as never)} hitSlop={8}>
            <T w="semibold" size={12} color={C.brandDark}>{action.label}</T>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.page, gap: 10 }}>
        {items.map((p) => (
          <Pressable key={p.id} onPress={() => router.push(`/product/${p.id}`)} style={styles.tile}>
            <View style={styles.tileImg}>{p.image ? <CachedImage source={p.image} width={240} style={FILL} contentFit="cover" /> : null}</View>
            <T size={11} color={C.muted} numberOfLines={1} style={{ marginTop: 5 }}>{p.title}</T>
            {p.price != null ? <T w="bold" size={13}>{inr(p.price)}</T> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function RecentlyViewedStrip() {
  const items = useSavedProducts("recent");
  return <Strip title="Recently Viewed" action={{ label: "VIEW ALL", href: "/account/recently-viewed" }} items={items.slice(0, 12)} />;
}

export function BestsellersStrip() {
  const q = useQuery({ queryKey: ["storefront", "bestsellers"], queryFn: () => getBestsellers(12), staleTime: 10 * 60 * 1000 });
  const items = (q.data?.products ?? []).map((p) => ({
    id: p.productId ?? p.id,
    title: p.title,
    image: p.image ?? null,
    price: p.salePrice ?? p.adminPrice ?? p.minPrice ?? null,
  }));
  return <Strip title="Bestsellers" items={items} />;
}

/** Live and upcoming sale events (Admin → Sale Events). */
export function SaleEventsStrip() {
  const router = useRouter();
  const t = useT();
  const q = useQuery({ queryKey: ["storefront", "sales"], queryFn: ({ signal }) => listSaleEvents(signal), staleTime: 5 * 60 * 1000 });
  const sales = q.data ?? [];
  if (!sales.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.page, gap: 10, paddingTop: 10 }}>
      {sales.map((s) => (
        <Pressable key={s.slug} onPress={() => router.push(`/sale/${s.slug}` as never)} style={styles.sale}>
          {s.bannerImage ? <CachedImage source={s.bannerImage} style={FILL} contentFit="cover" /> : null}
          <View style={[FILL, { backgroundColor: s.bannerImage ? "rgba(12,27,66,0.45)" : C.navy, padding: 12, justifyContent: "flex-end" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Feather name="zap" size={12} color={C.brand} />
              <T w="bold" size={10} color={C.brand}>{t(s.live ? "SALE IS LIVE" : "COMING SOON")}</T>
            </View>
            <T w="bold" size={16} color={C.white} numberOfLines={1}>{s.name}</T>
            {s.minDiscountPercent ? <T size={11} color="#D7DCEB">{t("Min. {pct}% off", { pct: s.minDiscountPercent })}</T> : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: S.page, marginBottom: 10 },
  tile: { width: 110 },
  tileImg: { width: 110, height: 130, borderRadius: 8, overflow: "hidden", backgroundColor: C.divider },
  sale: { width: 260, height: 110, borderRadius: 12, overflow: "hidden" },
  collection: { width: 130, height: 90, borderRadius: 10, overflow: "hidden" },
});

/** Curated collections (Admin → Collections), like the website's occasion pages. */
export function CollectionsStrip() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["storefront", "occasions"], queryFn: ({ signal }) => listOccasions(signal), staleTime: 30 * 60 * 1000 });
  const items = q.data ?? [];
  if (!items.length) return null;
  return (
    <View style={{ backgroundColor: C.card, marginTop: 10, paddingVertical: 12 }}>
      <View style={styles.head}><T w="semibold" size={16}>Collections</T></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.page, gap: 10 }}>
        {items.map((o) => (
          <Pressable key={o.id} onPress={() => router.push(`/collection/${o.slug}` as never)} style={styles.collection}>
            {o.image ? <CachedImage source={o.image} style={FILL} contentFit="cover" /> : null}
            <View style={[FILL, { backgroundColor: o.image ? "rgba(12,27,66,0.35)" : C.navy, justifyContent: "flex-end", padding: 8 }]}>
              <T w="semibold" size={13} color={C.white} numberOfLines={2}>{o.name}</T>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
