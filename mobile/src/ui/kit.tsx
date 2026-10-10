import * as React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import { CachedImage } from "../components/CachedImage";
import { useCart } from "../providers/CartProvider";
import { useWishlist } from "../providers/WishlistProvider";
import { useNotifications } from "../providers/NotificationProvider";
import { images as appImages } from "../data/images";
import { C, F, CATEGORY_TINT, FILL, inr } from "./theme";
import { CARD_IMAGES, CATEGORY_IMAGES } from "./storefront-assets";
import type { FeedProduct } from "./data";
import { Text } from "../i18n/Text";
import { useT } from "../i18n";

/* ── Text ───────────────────────────────────────────────────────────────── */

type Weight = "regular" | "medium" | "semibold" | "bold";
export function T({
  w = "regular",
  size = 14,
  color = C.text,
  style,
  ...rest
}: TextProps & { w?: Weight; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text {...rest} style={[{ fontFamily: F[w], fontSize: size, color }, style]} />;
}

/* ── Category art: uploaded image → website photo → tinted initial ──────── */

export function categoryImageSource(slug: string, uploaded?: string | null) {
  if (uploaded) return uploaded;
  return CATEGORY_IMAGES[slug] ?? CARD_IMAGES[slug] ?? null;
}

export function CategoryArt({
  slug,
  name,
  image,
  fallbackSlug,
  tintSlug,
  style,
}: {
  slug: string;
  name: string;
  image?: string | null;
  /** Categories (nearest first) whose photo to use when this one has none. */
  fallbackSlug?: string | string[];
  /** Main category whose colour (not photo) to use when this one has no photo. */
  tintSlug?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const chain = Array.isArray(fallbackSlug) ? fallbackSlug : fallbackSlug ? [fallbackSlug] : [];
  const src = categoryImageSource(slug, image) ?? chain.map((f) => categoryImageSource(f)).find(Boolean) ?? null;
  const tintKey = chain[chain.length - 1] ?? tintSlug;
  const tint = CATEGORY_TINT[slug] ?? (tintKey ? CATEGORY_TINT[tintKey] : undefined) ?? C.brandSoft;
  return (
    <View style={[{ backgroundColor: tint, overflow: "hidden", alignItems: "center", justifyContent: "center" }, style]}>
      {src ? (
        <CachedImage source={src as never} style={FILL} contentFit="cover" />
      ) : (
        <T w="bold" size={20} color={C.navy}>{name.charAt(0)}</T>
      )}
    </View>
  );
}

/* ── Icon button with optional count badge ──────────────────────────────── */

export function IconBtn({
  name,
  onPress,
  count,
  label,
  color = C.text,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  count?: number;
  label: string;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={styles.iconBtn}>
      <Feather name={name} size={22} color={color} />
      {count ? (
        <View style={styles.badge}>
          <T w="bold" size={10} color={C.white}>{count > 99 ? "99+" : count}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Wishlist, notifications and cart, as on every Meesho screen header. */
export function HeaderActions({ showNotifications = true }: { showNotifications?: boolean }) {
  const router = useRouter();
  const { cartCount } = useCart();
  const { unreadCount } = useNotifications();
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <IconBtn name="heart" label="Wishlist" onPress={() => router.push("/wishlist")} />
      {showNotifications ? <IconBtn name="bell" label="Notifications" count={unreadCount} onPress={() => router.push("/notifications")} /> : null}
      <IconBtn name="shopping-cart" label="Cart" count={cartCount} onPress={() => router.push("/cart")} />
    </View>
  );
}

/** Home header: logo left, actions right. */
export function HomeTopBar() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
      <CachedImage source={appImages.logo} style={{ width: 118, height: 30 }} contentFit="contain" />
      <HeaderActions />
    </View>
  );
}

/** Inner-screen header: back, title, actions. */
export function ScreenHeader({ title, subtitle, actions = true }: { title: string; subtitle?: string; actions?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))} hitSlop={10} accessibilityLabel="Back" style={{ paddingRight: 10 }}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w="semibold" size={16} numberOfLines={1}>{title}</T>
          {subtitle ? <T size={11} color={C.muted} numberOfLines={1}>{subtitle}</T> : null}
        </View>
      </View>
      {actions ? <HeaderActions showNotifications={false} /> : null}
    </View>
  );
}

/** Search field that opens the search screen, like Meesho's home search. */
export function SearchBarButton({ placeholder = "Search by keyword or product name" }: { placeholder?: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/search")} style={styles.search} accessibilityRole="search">
      <Feather name="search" size={18} color={C.muted} />
      <T size={13} color={C.faint} style={{ flex: 1, marginLeft: 8 }} numberOfLines={1}>{placeholder}</T>
      <Pressable onPress={() => router.push("/search?voice=1")} hitSlop={10} accessibilityLabel="Search by voice">
        <Feather name="mic" size={18} color={C.brandDark} />
      </Pressable>
    </Pressable>
  );
}

/* ── Price + rating ─────────────────────────────────────────────────────── */

export function priceOf(p: { salePrice?: number | null; price?: number | null; regularPrice?: number | null }) {
  const price = p.salePrice ?? p.price ?? null;
  const mrp = p.regularPrice != null && price != null && p.regularPrice > price ? p.regularPrice : null;
  const off = mrp && price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return { price, mrp, off };
}

export function RatingBadge({ average, count, size = "sm" }: { average: number; count?: number; size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={[styles.rating, big && { paddingHorizontal: 8, paddingVertical: 3 }]}>
        <T w="bold" size={big ? 14 : 11} color={C.white}>{average.toFixed(1)}</T>
        <Ionicons name="star" size={big ? 12 : 9} color={C.white} style={{ marginLeft: 2 }} />
      </View>
      {count != null ? <T size={big ? 13 : 11} color={C.muted} style={{ marginLeft: 6 }}>{count.toLocaleString("en-IN")} {count === 1 ? "Review" : "Reviews"}</T> : null}
    </View>
  );
}

/* ── Product card (Meesho grid card) ────────────────────────────────────── */

export const ProductCard = React.memo(function ProductCard({
  product,
  freeDelivery,
  width,
}: {
  product: FeedProduct;
  freeDelivery: boolean;
  width: number;
}) {
  const router = useRouter();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { price, mrp, off } = priceOf(product);
  const wished = isWishlisted(product.id);
  const rating = product.rating && product.rating.count > 0 && product.rating.average != null ? product.rating : null;
  const image = product.images?.[0];

  return (
    <Pressable onPress={() => router.push(`/product/${product.id}`)} style={[styles.card, { width }]}>
      <View style={{ width: "100%", aspectRatio: 0.82, backgroundColor: C.divider }}>
        {image ? <CachedImage source={image} width={Math.round(width * 2)} style={FILL} contentFit="cover" /> : null}
        <Pressable
          onPress={() => void toggleWishlist(product.id)}
          hitSlop={8}
          accessibilityLabel={wished ? "Remove from wishlist" : "Add to wishlist"}
          style={styles.cardHeart}
        >
          <Ionicons name={wished ? "heart" : "heart-outline"} size={18} color={wished ? C.red : C.textSoft} />
        </Pressable>
        {product.priceLock ? <PriceLockBadge style={{ position: "absolute", left: 6, top: 6 }} /> : null}
      </View>
      <View style={{ padding: 8, gap: 3 }}>
        <T size={13} color={C.muted} numberOfLines={1}>{product.title}</T>
        {price != null ? (
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
            <T w="bold" size={17}>{inr(price)}</T>
            {mrp ? (
              <>
                <T size={11} color={C.faint} style={{ marginLeft: 5, textDecorationLine: "line-through" }}>{inr(mrp)}</T>
                <T w="semibold" size={11} color={C.green} style={{ marginLeft: 4 }}>{off}% off</T>
              </>
            ) : null}
          </View>
        ) : (
          <T size={12} color={C.muted}>Price on request</T>
        )}
        {freeDelivery ? (
          <View style={styles.freeDelivery}><T size={10} color={C.textSoft}>Free Delivery</T></View>
        ) : null}
        <View style={{ height: 18, justifyContent: "center" }}>
          {rating ? <RatingBadge average={rating.average!} count={rating.count} /> : <T size={11} color={C.faint}>New arrival</T>}
        </View>
      </View>
    </Pressable>
  );
});

/** "KTMONA Price Lock": the seller's lowest market price, verified by KTMONA. */
export function PriceLockBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.navy, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, alignSelf: "flex-start" }, style]}>
      <Feather name="lock" size={10} color={C.brand} />
      <T w="bold" size={9} color={C.brand} style={{ letterSpacing: 0.6 }}>PRICE LOCK</T>
    </View>
  );
}

export function ProductCardSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.card, { width }]}>
      <View style={{ width: "100%", aspectRatio: 0.82, backgroundColor: C.divider }} />
      <View style={{ padding: 8, gap: 6 }}>
        <View style={{ height: 10, width: "80%", backgroundColor: C.divider, borderRadius: 4 }} />
        <View style={{ height: 14, width: "40%", backgroundColor: C.divider, borderRadius: 4 }} />
      </View>
    </View>
  );
}

/* ── Sort / filter bar and bottom sheet ─────────────────────────────────── */

export function SortFilterBar({
  sortLabel,
  onSort,
  onCategory,
  onFilter,
  activeFilters,
}: {
  sortLabel?: string;
  onSort: () => void;
  onCategory?: () => void;
  onFilter: () => void;
  activeFilters?: number;
}) {
  const t = useT();
  const Item = ({ icon, label, onPress, dot }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; onPress: () => void; dot?: boolean }) => (
    <Pressable onPress={onPress} style={styles.sfItem}>
      <Feather name={icon} size={15} color={C.text} />
      <T w="medium" size={13} style={{ marginLeft: 6 }} numberOfLines={1}>{label}</T>
      {dot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
  return (
    <View style={styles.sfBar}>
      <Item icon="bar-chart-2" label={sortLabel ? `${t("Sort")}: ${t(sortLabel)}` : "Sort"} onPress={onSort} dot={Boolean(sortLabel)} />
      <View style={styles.sfDivider} />
      {onCategory ? (
        <>
          <Item icon="grid" label="Category" onPress={onCategory} />
          <View style={styles.sfDivider} />
        </>
      ) : null}
      <Item icon="sliders" label="Filters" onPress={onFilter} dot={Boolean(activeFilters)} />
    </View>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHead}>
          <T w="semibold" size={15}>{title}</T>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Feather name="x" size={22} color={C.text} /></Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.radioRow}>
      <T size={14} w={selected ? "semibold" : "regular"} color={selected ? C.navy : C.text}>{label}</T>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? C.brandDark : C.faint} />
    </Pressable>
  );
}

export function PrimaryBtn({ label, onPress, loading, style, variant = "solid", icon }: { label: string; onPress: () => void; loading?: boolean; style?: StyleProp<ViewStyle>; variant?: "solid" | "outline"; icon?: React.ComponentProps<typeof Feather>["name"] }) {
  const solid = variant === "solid";
  return (
    <Pressable onPress={onPress} disabled={loading} style={[styles.btn, solid ? styles.btnSolid : styles.btnOutline, style]}>
      {loading ? (
        <ActivityIndicator color={solid ? C.white : C.navy} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={17} color={solid ? C.white : C.navy} style={{ marginRight: 8 }} /> : null}
          <T w="semibold" size={15} color={solid ? C.white : C.navy}>{label}</T>
        </>
      )}
    </Pressable>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 6 }}>
      <Feather name="shopping-bag" size={36} color={C.faint} />
      <T w="semibold" size={15} style={{ marginTop: 6 }}>{title}</T>
      {text ? <T size={13} color={C.muted} style={{ textAlign: "center" }}>{text}</T> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: C.card,
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: { padding: 7 },
  badge: {
    position: "absolute",
    top: 1,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: C.brandDark,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: C.card,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.greenBadge,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  card: { backgroundColor: C.card, borderRadius: 6, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  cardHeart: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  freeDelivery: { alignSelf: "flex-start", backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sfBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    height: 44,
  },
  sfItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 6, height: "100%" },
  sfDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: C.border },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.brand, marginLeft: 5 },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "80%" },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  radioRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  btn: { height: 48, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnSolid: { backgroundColor: C.brandDark },
  btnOutline: { backgroundColor: C.card, borderWidth: 1, borderColor: C.navy },
});

/* ── Gradient overlay (react-native-svg) ────────────────────────────────── */

export function Gradient({
  stops,
  direction = "horizontal",
  style,
}: {
  /** [offset 0..1, colour, opacity 0..1] */
  stops: [number, string, number][];
  direction?: "horizontal" | "vertical";
  style?: StyleProp<ViewStyle>;
}) {
  const id = React.useId().replace(/:/g, "");
  const horizontal = direction === "horizontal";
  return (
    <View pointerEvents="none" style={style}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <SvgLinearGradient id={id} x1="0" y1="0" x2={horizontal ? "1" : "0"} y2={horizontal ? "0" : "1"}>
            {stops.map(([o, c, a], i) => <Stop key={i} offset={o} stopColor={c} stopOpacity={a} />)}
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
