import * as React from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { CachedImage } from "../../components/CachedImage";
import { C, FILL, S } from "../theme";
import { CategoryArt, Gradient, HomeTopBar, SearchBarButton, T } from "../kit";
import { ProductFeedList } from "../ProductFeedList";
import { BANNER_IMAGES } from "../storefront-assets";
import { bannerHrefToRoute, findBySlug, useCategoryTree, useHomeBanners, type CategoryNode, type RemoteBanner } from "../data";

/* Built-in banners: the website's hero photos with the same copy. */
const BUILT_IN = [
  { key: "hero-smart", eyebrow: "TRUST EVERY CLICK", title: "Smart Shopping,\nVerified Sellers", cta: "Shop Now", route: "/marketplace", tint: "#0C1B42", light: true },
  { key: "hero-ethnic", eyebrow: "FESTIVE EDIT", title: "Sarees, Kurtis\n& Kurta Sets", cta: "Explore Ethnic Wear", route: "/category/kurti-saree", tint: "#FF8A00", light: false },
  { key: "hero-gadgets", eyebrow: "GADGETS & APPLIANCES", title: "Electronics,\nWatches & More", cta: "Shop Electronics", route: "/category/electronics", tint: "#0B3B5C", light: true },
];

const POPULAR = [
  { slug: "kurtis", label: "Kurtis" },
  { slug: "sarees", label: "Sarees" },
  { slug: "top-wear", label: "Men Topwear" },
  { slug: "topwear", label: "Women Topwear" },
  { slug: "women-footwear", label: "Women Footwear" },
  { slug: "audio", label: "Audio" },
  { slug: "makeup", label: "Makeup" },
  { slug: "kitchen-and-dining", label: "Kitchen" },
  { slug: "toys-and-games", label: "Toys" },
  { slug: "smart-watches", label: "Smart Watches" },
  { slug: "women-bags", label: "Bags" },
  { slug: "fitness", label: "Fitness" },
];

const FESTIVE = [
  { slug: "sarees", label: "Sarees" },
  { slug: "kurtis", label: "Kurtis" },
  { slug: "ethnic-wear", label: "Men Ethnic", art: "men" },
  { slug: "women-jewellery", label: "Jewellery", art: "jewellery-accessories" },
];

export default function HomeScreen() {
  const { tree } = useCategoryTree();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.card }}>
        <HomeTopBar />
        <View style={{ paddingHorizontal: S.page, paddingBottom: 10 }}>
          <SearchBarButton />
        </View>
      </View>
      <ProductFeedList
        categories={tree}
        header={
          <View>
            <CategoryStrip tree={tree} />
            <HeroCarousel />
            <TrustStrip />
            <PopularCategories tree={tree} />
            <FestiveBand tree={tree} />
          </View>
        }
      />
    </View>
  );
}

/* ── Category circles ───────────────────────────────────────────────────── */

function CategoryStrip({ tree }: { tree: CategoryNode[] }) {
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: C.card }} contentContainerStyle={{ paddingHorizontal: S.page, paddingVertical: 12, gap: 14 }}>
      <Pressable onPress={() => router.push("/categories")} style={styles.circleItem}>
        <View style={[styles.circle, { backgroundColor: C.navySoft, alignItems: "center", justifyContent: "center" }]}>
          <Feather name="grid" size={24} color={C.navy} />
        </View>
        <T size={11} w="medium" numberOfLines={2} style={styles.circleLabel}>Categories</T>
      </Pressable>
      {tree.map((c) => (
        <Pressable key={c.id} onPress={() => router.push(`/category/${c.slug}`)} style={styles.circleItem}>
          <CategoryArt slug={c.slug} name={c.name} image={c.image} style={styles.circle} />
          <T size={11} w="medium" numberOfLines={2} style={styles.circleLabel}>{c.name}</T>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/* ── Hero carousel ──────────────────────────────────────────────────────── */

function HeroCarousel() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data } = useHomeBanners();
  const slideW = width - S.page * 2;
  const slideH = Math.round(slideW * 0.5);
  const [index, setIndex] = React.useState(0);
  const listRef = React.useRef<FlatList<unknown>>(null);
  const remote = data?.hero ?? [];
  const count = remote.length || BUILT_IN.length;

  React.useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % count;
        listRef.current?.scrollToOffset({ offset: next * (slideW + S.gap), animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [count, slideW]);

  const renderRemote = ({ item }: { item: RemoteBanner }) => (
    <Pressable onPress={() => { const r = bannerHrefToRoute(item.href); if (r) router.push(r as never); }} style={{ width: slideW, height: slideH, borderRadius: 10, overflow: "hidden" }}>
      <CachedImage source={item.mobileImageUrl || item.imageUrl} style={FILL} contentFit="cover" />
    </Pressable>
  );
  const renderBuiltIn = ({ item }: { item: (typeof BUILT_IN)[number] }) => (
    <Pressable onPress={() => router.push(item.route as never)} style={{ width: slideW, height: slideH, borderRadius: 10, overflow: "hidden", backgroundColor: item.tint }}>
      <Image source={BANNER_IMAGES[item.key]} style={[FILL, { left: "28%" }]} contentFit="cover" contentPosition="right" />
      <Gradient stops={[[0, item.tint, 1], [0.35, item.tint, 1], [0.72, item.tint, 0]]} style={StyleSheet.absoluteFill} />
      <View style={{ position: "absolute", left: 16, top: 0, bottom: 0, justifyContent: "center", width: "62%" }}>
        <T w="semibold" size={10} color={item.light ? "#FFAA02" : C.navy} style={{ letterSpacing: 1.5 }}>{item.eyebrow}</T>
        <T w="bold" size={19} color={item.light ? C.white : C.navy} style={{ marginTop: 4, lineHeight: 23 }}>{item.title}</T>
        <View style={[styles.heroCta, { backgroundColor: item.light ? C.white : C.navy }]}>
          <T w="semibold" size={12} color={item.light ? C.navy : C.white}>{item.cta}</T>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ paddingTop: 12, backgroundColor: C.bg }}>
      <FlatList
        ref={listRef as never}
        data={(remote.length ? remote : BUILT_IN) as never[]}
        keyExtractor={(_, i) => String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideW + S.gap}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: S.page, gap: S.gap }}
        renderItem={(remote.length ? renderRemote : renderBuiltIn) as never}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (slideW + S.gap)))}
      />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 8 }}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={{ height: 6, width: i === index ? 16 : 6, borderRadius: 3, backgroundColor: i === index ? C.brand : C.border }} />
        ))}
      </View>
    </View>
  );
}

/* ── Trust strip ────────────────────────────────────────────────────────── */

function TrustStrip() {
  const items: { icon: React.ComponentProps<typeof Feather>["name"]; label: string }[] = [
    { icon: "rotate-ccw", label: "Easy Returns" },
    { icon: "shield", label: "Secure Payments" },
    { icon: "check-circle", label: "Verified Sellers" },
  ];
  return (
    <View style={styles.trust}>
      {items.map((it, i) => (
        <View key={it.label} style={[styles.trustItem, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: C.border }]}>
          <Feather name={it.icon} size={14} color={C.brandDark} />
          <T size={11} w="medium" color={C.textSoft} style={{ marginLeft: 5 }} numberOfLines={1}>{it.label}</T>
        </View>
      ))}
    </View>
  );
}

/* ── Popular categories cards ───────────────────────────────────────────── */

function PopularCategories({ tree }: { tree: CategoryNode[] }) {
  const router = useRouter();
  const items = POPULAR.filter((p) => !tree.length || findBySlug(tree, p.slug));
  return (
    <View style={{ backgroundColor: C.card, marginTop: 10, paddingVertical: 12 }}>
      <View style={styles.sectionHead}>
        <T w="semibold" size={16}>Popular Categories</T>
        <Pressable onPress={() => router.push("/categories")} hitSlop={8}><T w="semibold" size={12} color={C.brandDark}>VIEW ALL</T></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.page, gap: 10 }}>
        {items.map((p) => (
          <Pressable key={p.slug} onPress={() => router.push(`/category/${p.slug}`)} style={styles.popCard}>
            <CategoryArt slug={p.slug} name={p.label} style={{ width: "100%", aspectRatio: 1 }} />
            <View style={styles.popLabel}><T w="semibold" size={12} color={C.white} numberOfLines={1}>{p.label}</T></View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* ── Festive band ───────────────────────────────────────────────────────── */

function FestiveBand({ tree }: { tree: CategoryNode[] }) {
  const router = useRouter();
  const { data } = useHomeBanners();
  const promo = data?.promo;
  if (promo) {
    return (
      <Pressable onPress={() => { const r = bannerHrefToRoute(promo.href); if (r) router.push(r as never); }} style={{ marginTop: 10 }}>
        <CachedImage source={promo.mobileImageUrl || promo.imageUrl} style={{ width: "100%", aspectRatio: 2 }} contentFit="cover" />
      </Pressable>
    );
  }
  const tiles = FESTIVE.filter((t) => !tree.length || findBySlug(tree, t.slug));
  return (
    <View style={{ marginTop: 10, backgroundColor: "#2E1D10" }}>
      <View style={{ width: "100%", aspectRatio: 1.7 }}>
        <Image source={BANNER_IMAGES["promo-festive"]} style={FILL} contentFit="cover" contentPosition="right" />
        <Gradient direction="vertical" stops={[[0, "#2E1D10", 0], [0.55, "#2E1D10", 0.2], [1, "#2E1D10", 1]]} style={StyleSheet.absoluteFill} />
        <View style={{ position: "absolute", left: 16, bottom: 14, right: 16 }}>
          <T w="semibold" size={10} color="#F5C76B" style={{ letterSpacing: 2 }}>KTMONA FESTIVE</T>
          <T w="bold" size={24} color="#F5D58A" style={{ marginTop: 2 }}>Wedding & Festive Edit</T>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 }}>
        {tiles.map((t) => (
          <Pressable key={t.slug} onPress={() => router.push(`/category/${t.slug}`)} style={{ flex: 1 }}>
            <CategoryArt slug={t.art ?? t.slug} name={t.label} style={styles.arch} />
            <T w="semibold" size={11} color={C.white} style={{ textAlign: "center", marginTop: 5 }} numberOfLines={1}>{t.label}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  circleItem: { width: 64, alignItems: "center" },
  circle: { width: 60, height: 60, borderRadius: 30 },
  circleLabel: { textAlign: "center", marginTop: 5, color: C.text },
  heroCta: { alignSelf: "flex-start", marginTop: 10, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  trust: {
    flexDirection: "row",
    marginHorizontal: S.page,
    marginTop: 12,
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingVertical: 9,
  },
  trustItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: S.page, marginBottom: 10 },
  popCard: { width: 112, borderRadius: 10, overflow: "hidden", backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  popLabel: { backgroundColor: C.navy, paddingVertical: 7, paddingHorizontal: 6, alignItems: "center" },
  arch: { width: "100%", aspectRatio: 0.8, borderTopLeftRadius: 100, borderTopRightRadius: 100, borderWidth: 2, borderColor: "rgba(245,199,107,0.7)" },
});

