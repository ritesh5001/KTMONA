import * as React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { CachedImage } from "../../components/CachedImage";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../providers/CartProvider";
import { useWishlist } from "../../providers/WishlistProvider";
import { useToast } from "../../providers/ToastProvider";
import { trackPendingCartWrite } from "../../lib/pending-cart";
import { getProductById, getProducts, type ProductVariant } from "../../services/products";
import { fetchProductReviews } from "../../services/reviews";
import { C, FILL, S, inr } from "../theme";
import { EmptyState, HeaderActions, PriceLockBadge, PrimaryBtn, ProductCard, RatingBadge, T, priceOf } from "../kit";
import { useFreeDelivery, type FeedProduct } from "../data";
import { BookCallSheet, ShareSheet } from "../sheets";
import { rememberProduct } from "../../lib/local-lists";

type Detail = Awaited<ReturnType<typeof getProductById>>["product"] & {
  seller?: { storeName: string; storeSlug: string } | null;
  sellerId?: string;
  /** KTMONA Price Lock: lowest market price, verified by KTMONA. */
  priceLock?: boolean;
  activeCoupon?: { code?: string; discountedPrice?: number | null; finalPrice?: number | null } | null;
};

export default function ProductScreen({ id }: { id: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { showToast } = useToast();
  const freeDelivery = useFreeDelivery();

  const productQ = useQuery({
    queryKey: ["storefront", "product", id],
    queryFn: ({ signal }) => getProductById(id, signal),
    staleTime: 60 * 1000,
  });
  const product = productQ.data?.product as Detail | undefined;

  const reviewsQ = useQuery({
    queryKey: ["storefront", "reviews", id],
    queryFn: ({ signal }) => fetchProductReviews(id, signal),
    enabled: Boolean(product),
    staleTime: 5 * 60 * 1000,
  });
  const similarQ = useQuery({
    queryKey: ["storefront", "similar", product?.categoryId ?? product?.category?.id ?? null, id],
    queryFn: ({ signal }) => getProducts({ page: 1, limit: 10, categoryId: product?.categoryId ?? product?.category?.id, signal }),
    enabled: Boolean(product?.categoryId ?? product?.category?.id),
    staleTime: 5 * 60 * 1000,
  });

  /* ── Variants: colour then size ── */
  const variants: ProductVariant[] = React.useMemo(() => product?.variants ?? [], [product]);
  const colors = React.useMemo(() => Array.from(new Set(variants.map((v) => v.color).filter((c): c is string => Boolean(c)))), [variants]);
  const [color, setColor] = React.useState<string | null>(null);
  const [variantId, setVariantId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!product) return;
    if (colors.length && !color) setColor(colors[0]!);
    if (variants.length === 1) setVariantId(variants[0]!.id);
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps
  const sizeOptions = variants.filter((v) => !colors.length || v.color === color);
  const selected = variants.find((v) => v.id === variantId) ?? null;
  const needsSize = sizeOptions.length > 1 || (sizeOptions.length === 1 && sizeOptions[0]!.size !== "Default");

  const images = React.useMemo(() => {
    const colourImages = color ? variants.find((v) => v.color === color && v.images?.length)?.images : undefined;
    return (colourImages?.length ? colourImages : product?.images) ?? [];
  }, [product, color, variants]);

  /* ── Price shown follows the selected variant ── */
  const base = priceOf(product ?? {});
  const price = selected?.price ?? base.price;
  const mrp = selected?.compareAtPrice && price != null && selected.compareAtPrice > price ? selected.compareAtPrice : selected ? null : base.mrp;
  const off = mrp && price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const couponPrice = product?.activeCoupon?.discountedPrice ?? product?.activeCoupon?.finalPrice ?? null;
  const summary = reviewsQ.data?.summary ?? null;
  const reviews = reviewsQ.data?.reviews ?? [];
  const similar = ((similarQ.data?.data ?? []) as FeedProduct[]).filter((p) => p.id !== id).slice(0, 6);
  const wished = isWishlisted(id);

  const [shareOpen, setShareOpen] = React.useState(false);
  const [callOpen, setCallOpen] = React.useState(false);

  // Recently viewed (Home + Account), Meesho-style.
  React.useEffect(() => {
    if (!product) return;
    const p = priceOf(product);
    void rememberProduct("recent", { id: product.id, title: product.title, image: product.images?.[0] ?? null, price: p.price, regularPrice: p.mrp });
  }, [product]);

  const scrollRef = React.useRef<ScrollView>(null);
  const sizeY = React.useRef(0);
  const [busy, setBusy] = React.useState<"cart" | "buy" | null>(null);

  const ensureReady = (): ProductVariant | null => {
    if (!session?.accessToken) {
      showToast("Please sign in to continue", "info");
      router.push("/login");
      return null;
    }
    if (!product) return null;
    const v = selected ?? (sizeOptions.length === 1 ? sizeOptions[0]! : null);
    if (!v) {
      showToast(colors.length && !color ? "Select a colour" : "Select a size", "info");
      scrollRef.current?.scrollTo({ y: Math.max(0, sizeY.current - 80), animated: true });
      return null;
    }
    if (v.inventory && v.inventory.stock <= 0) {
      showToast("This size is out of stock", "info");
      return null;
    }
    return v;
  };

  const preview = (v: ProductVariant) => ({
    title: product!.title,
    image: images[0] ?? product!.images?.[0] ?? "",
    size: v.size,
    color: v.color ?? null,
    colorHex: (v as { colorHex?: string | null }).colorHex ?? null,
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? null,
  });

  const onAddToCart = async () => {
    const v = ensureReady();
    if (!v) return;
    setBusy("cart");
    try {
      await addToCart({ productId: product!.id, variantId: v.id, quantity: 1, preview: preview(v) });
      showToast("Added to cart", "success");
    } catch {
      // CartProvider shows the error.
    } finally {
      setBusy(null);
    }
  };

  const onBuyNow = () => {
    const v = ensureReady();
    if (!v) return;
    const write = addToCart({ productId: product!.id, variantId: v.id, quantity: 1, preview: preview(v) });
    trackPendingCartWrite(write);
    write.catch(() => undefined);
    router.push(`/checkout?buyNowVariantId=${encodeURIComponent(v.id)}`);
  };

  const onShare = () => {
    if (!product) return;
    setShareOpen(true);
  };
  const shareable = product
    ? { id: product.id, title: product.title, image: images[0] ?? product.images?.[0] ?? null, price: price ?? null, regularPrice: mrp ?? null }
    : null;

  if (productQ.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.card }}>
        <TopBar insetTop={insets.top} onShare={onShare} />
        <ActivityIndicator color={C.brand} style={{ marginTop: 80 }} />
      </View>
    );
  }
  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar insetTop={insets.top} onShare={onShare} />
        <EmptyState title="Product not available" text="It may have been removed or is no longer sold." action={<PrimaryBtn label="Continue shopping" onPress={() => router.replace("/home")} style={{ marginTop: 10 }} />} />
      </View>
    );
  }

  const cardW = Math.floor((width - S.page * 2 - S.gap) / 2);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar insetTop={insets.top} onShare={onShare} />
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}>
        <Gallery images={images} width={width} />

        {/* Title, price, rating */}
        <View style={styles.block}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <T size={14} color={C.textSoft} style={{ flex: 1 }}>{product.title}</T>
            <Pressable onPress={() => void toggleWishlist(product.id)} hitSlop={10} style={{ paddingLeft: 10 }} accessibilityLabel="Wishlist">
              <Ionicons name={wished ? "heart" : "heart-outline"} size={24} color={wished ? C.red : C.textSoft} />
            </Pressable>
          </View>
          {price != null ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 6, flexWrap: "wrap" }}>
              <T w="bold" size={24}>{inr(price)}</T>
              {mrp ? (
                <>
                  <T size={14} color={C.faint} style={{ marginLeft: 8, textDecorationLine: "line-through" }}>{inr(mrp)}</T>
                  <T w="semibold" size={14} color={C.green} style={{ marginLeft: 6 }}>{off}% off</T>
                </>
              ) : null}
            </View>
          ) : null}
          {product.priceLock ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 }}>
              <PriceLockBadge />
              <T size={11} color={C.muted}>Lowest price in the market, verified by KTMONA</T>
            </View>
          ) : null}
          {couponPrice != null && price != null && couponPrice < price ? (
            <View style={styles.coupon}>
              <Feather name="tag" size={13} color={C.green} />
              <T size={12} w="medium" color={C.green} style={{ marginLeft: 6 }}>Get it for {inr(couponPrice)} with coupon{product.activeCoupon?.code ? ` ${product.activeCoupon.code}` : ""}</T>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {summary && summary.totalReviews > 0 ? <RatingBadge average={summary.averageRating} count={summary.totalReviews} /> : <T size={12} color={C.faint}>No ratings yet</T>}
            {freeDelivery ? <View style={styles.pill}><T size={11} color={C.textSoft}>Free Delivery</T></View> : null}
          </View>
        </View>

        {/* Colour + size */}
        {colors.length > 1 || needsSize ? (
          <View style={styles.block} onLayout={(e: LayoutChangeEvent) => { sizeY.current = e.nativeEvent.layout.y; }}>
            {colors.length > 1 ? (
              <>
                <T w="semibold" size={15}>Select Colour</T>
                <View style={styles.chips}>
                  {colors.map((c) => (
                    <Pressable key={c} onPress={() => { setColor(c); setVariantId(null); }} style={[styles.chip, color === c && styles.chipOn]}>
                      <T size={13} w={color === c ? "semibold" : "regular"} color={color === c ? C.navy : C.text}>{c}</T>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            {needsSize ? (
              <>
                <T w="semibold" size={15} style={colors.length > 1 ? { marginTop: 14 } : undefined}>Select Size</T>
                <View style={styles.chips}>
                  {sizeOptions.map((v) => {
                    const out = v.inventory != null && v.inventory.stock <= 0;
                    const on = v.id === variantId;
                    return (
                      <Pressable key={v.id} disabled={out} onPress={() => setVariantId(v.id)} style={[styles.chip, on && styles.chipOn, out && { opacity: 0.4 }]}>
                        <T size={13} w={on ? "semibold" : "regular"} color={on ? C.navy : C.text} style={out ? { textDecorationLine: "line-through" } : undefined}>{v.size}</T>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {/* Product details */}
        <Details product={product} selected={selected} />

        {/* Sold by */}
        {product.seller ? (
          <View style={styles.block}>
            <T w="semibold" size={15}>Sold By</T>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
              <View style={styles.storeIcon}><Feather name="shopping-bag" size={20} color={C.navy} /></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <T w="semibold" size={14}>{product.seller.storeName}</T>
                <T size={11} color={C.muted}>Verified KTMONA seller</T>
              </View>
              <Pressable onPress={() => router.push(`/shop/${product.seller!.storeSlug}` as never)} style={styles.viewShop}>
                <T w="semibold" size={12} color={C.navy}>View Shop</T>
              </Pressable>
            </View>
            {product.sellerId ? (
              <Pressable
                onPress={() => {
                  if (!session?.accessToken) {
                    showToast("Please sign in to continue", "info");
                    router.push("/login");
                    return;
                  }
                  setCallOpen(true);
                }}
                style={styles.callRow}
              >
                <Feather name="video" size={18} color={C.brandDark} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <T w="semibold" size={13}>Video call with seller</T>
                  <T size={11} color={C.muted}>See the product live before you buy</T>
                </View>
                <Feather name="chevron-right" size={18} color={C.faint} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Promises */}
        <View style={[styles.block, { flexDirection: "row", justifyContent: "space-around" }]}>
          {[
            { icon: "rotate-ccw" as const, label: "Easy Returns" },
            { icon: "shield" as const, label: "Secure Payments" },
            { icon: "check-circle" as const, label: "Verified Seller" },
          ].map((p) => (
            <View key={p.label} style={{ alignItems: "center", gap: 5 }}>
              <View style={styles.promiseIcon}><Feather name={p.icon} size={18} color={C.brandDark} /></View>
              <T size={11} color={C.textSoft}>{p.label}</T>
            </View>
          ))}
        </View>

        {/* Ratings & reviews */}
        <View style={styles.block}>
          <T w="semibold" size={15}>Product Ratings & Reviews</T>
          {summary && summary.totalReviews > 0 ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
                <View style={{ alignItems: "center", width: 96 }}>
                  <T w="bold" size={30} color={C.green}>{summary.averageRating.toFixed(1)}</T>
                  <Ionicons name="star" size={14} color={C.green} />
                  <T size={11} color={C.muted} style={{ marginTop: 4, textAlign: "center" }}>{summary.totalReviews} {summary.totalReviews === 1 ? "review" : "reviews"}</T>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const n = summary.ratingDistribution?.[star] ?? 0;
                    const pct = summary.totalReviews ? n / summary.totalReviews : 0;
                    return (
                      <View key={star} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <T size={11} color={C.muted} style={{ width: 10 }}>{star}</T>
                        <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: star >= 3 ? C.greenBadge : star === 2 ? "#F59E0B" : C.red }]} /></View>
                        <T size={11} color={C.muted} style={{ width: 24, textAlign: "right" }}>{n}</T>
                      </View>
                    );
                  })}
                </View>
              </View>
              {reviews.slice(0, 3).map((r) => (
                <View key={r.id} style={styles.review}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <RatingBadge average={r.rating} />
                    <T w="medium" size={12}>{r.user?.fullName || "KTMONA customer"}</T>
                    <T size={11} color={C.faint}>{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</T>
                  </View>
                  {r.text ? <T size={13} color={C.textSoft} style={{ marginTop: 6 }}>{r.text}</T> : null}
                  {r.images?.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
                      {r.images.slice(0, 5).map((src) => <CachedImage key={src} source={src} style={{ width: 56, height: 56, borderRadius: 6 }} contentFit="cover" />)}
                    </ScrollView>
                  ) : null}
                </View>
              ))}
            </>
          ) : (
            <T size={13} color={C.muted} style={{ marginTop: 8 }}>No reviews yet. Buyers can review after delivery.</T>
          )}
        </View>

        {/* Similar products */}
        {similar.length ? (
          <View style={{ paddingTop: 12 }}>
            <T w="semibold" size={16} style={{ paddingHorizontal: S.page }}>Similar Products</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.gap, paddingHorizontal: S.page, marginTop: 10 }}>
              {similar.map((p) => <ProductCard key={p.id} product={p} freeDelivery={freeDelivery} width={cardW} />)}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky actions: Meesho keeps a WhatsApp share next to the buttons */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable onPress={onShare} style={styles.waShare} accessibilityLabel="Share">
          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          <T size={10} w="semibold" color={C.textSoft}>Share</T>
        </Pressable>
        <PrimaryBtn label="Add to Cart" icon="shopping-cart" variant="outline" loading={busy === "cart"} onPress={() => void onAddToCart()} style={{ flex: 1 }} />
        <PrimaryBtn label="Buy Now" icon="chevrons-right" onPress={onBuyNow} style={{ flex: 1 }} />
      </View>
      <ShareSheet product={shareable} open={shareOpen} onClose={() => setShareOpen(false)} />
      {product.sellerId ? (
        <BookCallSheet open={callOpen} onClose={() => setCallOpen(false)} sellerId={product.sellerId} productId={product.id} storeName={product.seller?.storeName} />
      ) : null}
    </View>
  );
}

function TopBar({ insetTop, onShare }: { insetTop: number; onShare: () => void }) {
  const router = useRouter();
  return (
    <View style={[styles.topBar, { paddingTop: insetTop + 6 }]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))} hitSlop={10} accessibilityLabel="Back">
        <Feather name="arrow-left" size={22} color={C.text} />
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable onPress={onShare} hitSlop={8} style={{ padding: 7 }} accessibilityLabel="Share">
          <Feather name="share-2" size={21} color={C.text} />
        </Pressable>
        <HeaderActions showNotifications={false} />
      </View>
    </View>
  );
}

function Gallery({ images, width }: { images: string[]; width: number }) {
  const [index, setIndex] = React.useState(0);
  const height = Math.round(width * 1.1);
  if (!images.length) return <View style={{ width, height, backgroundColor: C.divider }} />;
  return (
    <View style={{ backgroundColor: C.card }}>
      <FlatList
        data={images}
        keyExtractor={(src, i) => src + i}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <CachedImage source={item} width={Math.round(width * 2)} style={FILL} contentFit="contain" />
          </View>
        )}
      />
      {images.length > 1 ? (
        <>
          <View style={styles.counter}><T w="semibold" size={11} color={C.white}>{index + 1}/{images.length}</T></View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, paddingVertical: 8 }}>
            {images.map((_, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === index ? C.brand : C.border }} />)}
          </View>
        </>
      ) : null}
    </View>
  );
}

function Details({ product, selected }: { product: Detail; selected: ProductVariant | null }) {
  const [open, setOpen] = React.useState(false);
  const rows: [string, string][] = [];
  if (product.category?.name) rows.push(["Category", product.category.name]);
  if (selected?.color) rows.push(["Colour", selected.color]);
  if (selected && selected.size !== "Default") rows.push(["Size", selected.size]);
  if (selected?.sku) rows.push(["Product code", selected.sku]);
  const desc = product.description?.trim() ?? "";
  const long = desc.length > 220;
  return (
    <View style={styles.block}>
      <T w="semibold" size={15}>Product Details</T>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: "row", marginTop: 8 }}>
          <T size={13} color={C.muted} style={{ width: 110 }}>{k}</T>
          <T size={13} style={{ flex: 1 }}>{v}</T>
        </View>
      ))}
      {desc ? (
        <>
          <T size={13} color={C.textSoft} style={{ marginTop: 10, lineHeight: 19 }} numberOfLines={open || !long ? undefined : 5}>{desc}</T>
          {long ? (
            <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} style={{ marginTop: 6 }}>
              <T w="semibold" size={12} color={C.brandDark}>{open ? "Show less" : "More"}</T>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  callRow: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  waShare: { width: 54, alignItems: "center", justifyContent: "center", gap: 2 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingBottom: 6, backgroundColor: C.card, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  block: { backgroundColor: C.card, padding: 14, marginTop: 8 },
  pill: { backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  coupon: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 8, backgroundColor: "#E7F7EF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { minWidth: 48, paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: C.card },
  chipOn: { borderColor: C.navy, backgroundColor: C.navySoft },
  storeIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.navySoft, alignItems: "center", justifyContent: "center" },
  viewShop: { borderWidth: 1, borderColor: C.navy, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  promiseIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brandSoft, alignItems: "center", justifyContent: "center" },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.divider, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  review: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginTop: 12, paddingTop: 12 },
  counter: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(12,27,66,0.6)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
});
