import * as React from "react";
import {
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import { Text } from "../i18n/Text";
import { usePathname, useRouter } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Icon, type IconName } from "./Icon";
import { colors, spacing, typography, radius } from "../theme/tokens";
import { images } from "../data/images";
import { MenuSheet } from "./MenuSheet";
import { Image } from "./CompatImage";
import { useCart } from "../providers/CartProvider";
import { useCartArrivalPulse } from "./FlyToCart";
import { impactLight } from "../utils/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Every icon in the bar is the same size; mixed sizes were the untidiest part. */
const HEADER_ICON_SIZE = 20;

/**
 * A header control that answers the finger — without wearing a container.
 *
 * The discs and bordered boxes read as chips stuck around the glyphs: three
 * competing shapes across one bar, none of them meaning anything. Luxury retail
 * puts the mark on its own and lets the response carry the interaction.
 *
 * So there is no shape here at all. On press the glyph itself firms up: it
 * presses down, warms from charcoal to gold, and a hairline gold rule draws
 * beneath it — the same rule-and-mark language as the section headings, rather
 * than a bubble borrowed from a settings app. All on the UI thread.
 */
const HeaderIconButton = React.memo(function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size = HEADER_ICON_SIZE,
  children,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  size?: number;
  children?: React.ReactNode;
}) {
  const press = useSharedValue(0);

  // Firm rather than bouncy: a considered press, not a toy button.
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.12 * press.value }],
  }));

  // The tint is a crossfade of two stacked copies — icon-font colour cannot be
  // interpolated on the UI thread.
  const restingStyle = useAnimatedStyle(() => ({ opacity: 1 - press.value }));
  const warmStyle = useAnimatedStyle(() => ({
    opacity: press.value,
    ...StyleSheet.absoluteFillObject,
  }));

  // Draws outward from the centre, so it reads as being underlined rather than
  // as a bar sliding in from one side.
  const ruleStyle = useAnimatedStyle(() => ({
    opacity: press.value,
    transform: [{ scaleX: 0.2 + 0.8 * press.value }],
  }));

  return (
    <AnimatedPressable
      style={styles.iconButton}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 110 });
        impactLight();
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 17, stiffness: 230, mass: 0.65 });
      }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View style={glyphStyle}>
        <Animated.View style={restingStyle}>
          <Icon name={icon} size={size} color={colors.charcoal} />
        </Animated.View>
        <Animated.View style={warmStyle} pointerEvents="none">
          <Icon name={icon} size={size} color={colors.gold} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.pressRule, ruleStyle]} pointerEvents="none" />
      {children}
    </AnimatedPressable>
  );
});

/**
 * Live cart count.
 *
 * The bar already pulsed when something landed, but never said how much was in
 * the bag — the shopper had to open the cart to find out. The badge springs in
 * on first item and springs away on empty rather than blinking.
 */
const CartBadge = React.memo(function CartBadge({ count }: { count: number }) {
  const shown = useSharedValue(count > 0 ? 1 : 0);

  React.useEffect(() => {
    shown.value = withSpring(count > 0 ? 1 : 0, {
      damping: 13,
      stiffness: 260,
      mass: 0.6,
    });
  }, [count, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: shown.value }],
  }));

  return (
    <Animated.View
      style={[styles.cartBadge, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.cartBadgeText}>{count > 9 ? "9+" : count}</Text>
    </Animated.View>
  );
});

interface AppHeaderProps {
  variant?: "main" | "sub";
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showMenu?: boolean;
  showSearch?: boolean;
  showProfile?: boolean;
  showWishlist?: boolean;
  showCart?: boolean;
}

export function AppHeader({
  variant = "sub",
  title,
  subtitle,
  showBack,
  showMenu,
  showSearch,
  showProfile,
  showWishlist,
  showCart,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Pulse the cart icon whenever the count rises, wherever the add came from —
  // this is the landing beat for the thumbnail that flies up from the product
  // page, and a standalone confirmation everywhere else.
  const { cartCount } = useCart();
  const { pulse, style: cartPulseStyle } = useCartArrivalPulse();
  const previousCountRef = React.useRef(cartCount);
  React.useEffect(() => {
    if (cartCount > previousCountRef.current) pulse();
    previousCountRef.current = cartCount;
  }, [cartCount, pulse]);

  const isMainHeader = variant === "main";
  const shouldShowBack = isMainHeader ? false : (showBack ?? pathname !== "/home");
  const shouldShowMenu = showMenu ?? isMainHeader;
  const shouldShowSearch = showSearch ?? isMainHeader;
  const shouldShowProfile = showProfile ?? false;
  const shouldShowWishlist = showWishlist ?? false;
  const shouldShowCart = showCart ?? isMainHeader;
  const menuOnLeft = shouldShowMenu && !isMainHeader && !shouldShowBack;
  const backFallbackRoute = "/home";
  const actionCount = [
    shouldShowSearch,
    shouldShowProfile,
    shouldShowWishlist,
    shouldShowCart,
    shouldShowMenu && !isMainHeader && !menuOnLeft,
  ].filter(Boolean).length;
  // Matching edge widths keep a sub-screen title optically centred even when
  // several actions sit on the right.
  const edgeWidth = isMainHeader
    ? 88
    : Math.max(56, actionCount * 44);

  const handleOpenMenu = React.useCallback(() => {
    setMenuOpen(true);
  }, []);

  const handleBack = React.useCallback(() => {
    if (pathname === backFallbackRoute) {
      router.replace(backFallbackRoute);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(backFallbackRoute);
  }, [backFallbackRoute, pathname, router]);

  return (
    <View style={styles.container} accessibilityRole="header">
      <View style={styles.row}>
        <View style={[styles.leftSlot, { width: edgeWidth }]}>
          {isMainHeader ? (
            shouldShowMenu ? (
              <HeaderIconButton
                icon="menu"
                onPress={handleOpenMenu}
                accessibilityLabel="Open navigation menu"
              />
            ) : (
              <View style={styles.leftSpacer} />
            )
          ) : shouldShowBack ? (
            <HeaderIconButton
              icon="chevron-back"
              onPress={handleBack}
              accessibilityLabel="Go back"
            />
          ) : menuOnLeft ? (
            <HeaderIconButton
              icon="menu"
              onPress={handleOpenMenu}
              accessibilityLabel="Open navigation menu"
            />
          ) : (
            <View style={styles.leftSpacer} />
          )}
        </View>

        <View
          style={styles.centerSlot}
          accessible={isMainHeader || !title}
          accessibilityLabel={isMainHeader || !title ? "KTMONA" : undefined}
        >
          {isMainHeader ? (
            <Image source={images.logo} style={styles.logo} contentFit="contain" />
          ) : title ? (
            <View style={styles.titleBlock}>
              <Text style={styles.titleText} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitleText} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : (
            <Image source={images.logo} style={styles.subLogo} contentFit="contain" />
          )}
        </View>

        <View style={[styles.actions, { width: edgeWidth }]}>
          {shouldShowSearch ? (
            <HeaderIconButton
              icon="search-outline"
              onPress={() => router.push("/search")}
              accessibilityLabel="Search"
              accessibilityHint="Opens product search"
            />
          ) : null}
          {shouldShowProfile ? (
            <HeaderIconButton
              icon="person-outline"
              onPress={() => router.push("/profile")}
              accessibilityLabel="Profile"
            />
          ) : null}
          {shouldShowWishlist ? (
            <HeaderIconButton
              icon="heart-outline"
              onPress={() => router.push("/wishlist")}
              accessibilityLabel="Wishlist"
            />
          ) : null}
          {shouldShowCart ? (
            <Animated.View style={cartPulseStyle}>
              <HeaderIconButton
                icon="bag-handle-outline"
                onPress={() => router.push("/cart")}
                accessibilityLabel={
                  cartCount > 0
                    ? `Shopping bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
                    : "Shopping bag, empty"
                }
              >
                <CartBadge count={cartCount} />
              </HeaderIconButton>
            </Animated.View>
          ) : null}
          {shouldShowMenu && !isMainHeader && !menuOnLeft ? (
            <HeaderIconButton
              icon="menu"
              onPress={handleOpenMenu}
              accessibilityLabel="Open navigation menu"
            />
          ) : null}
        </View>
      </View>

      <MenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={(route) => {
          setMenuOpen(false);
          router.push(route as any);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    // A hairline reads as a considered edge; a full pixel reads as a box.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    shadowColor: colors.charcoal,
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
    zIndex: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 58,
  },
  leftSlot: {
    flex: 0,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    zIndex: 50,
  },
  centerSlot: {
    flex: 1,
    // Must be allowed to shrink, or a long title pushes past its slot and
    // collides with the action icons instead of ellipsising.
    flexShrink: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    // Real clearance. This was spacing.xs — four points between a serif title
    // and a search glyph, which on the marketplace header read as the two
    // touching.
    paddingHorizontal: spacing.md,
  },
  leftSpacer: {
    width: 44,
    height: 44,
    justifyContent: "flex-start",
  },
  actions: {
    flex: 0,
    flexShrink: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 0,
  },
  /** A real 44dp target; hitSlop is only supplemental. */
  iconButton: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  /** The underline that draws on press. No container, just the mark. */
  pressRule: {
    position: "absolute",
    bottom: 5,
    width: 16,
    height: 1.5,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  cartBadge: {
    position: "absolute",
    top: 2,
    right: 1,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  cartBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: 9,
    lineHeight: 12,
    color: colors.background,
  },
  logo: {
    height: 36,
    width: "100%",
    maxWidth: 134,
    marginLeft: 0,
  },
  subLogo: {
    height: 32,
    width: "100%",
    maxWidth: 122,
  },
  titleBlock: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontFamily: typography.serif,
    // 18 was wide enough that a one-word title filled the whole slot. Smaller
    // with more tracking reads as more deliberate and takes noticeably less room.
    fontSize: 16,
    color: colors.foreground,
    letterSpacing: 1.1,
    // flexShrink rather than maxWidth: a percentage cap is measured against a
    // slot that has already overflowed, so it never actually clipped anything.
    flexShrink: 1,
    textAlign: "center",
  },
  subtitleText: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.45,
    color: colors.brownSoft,
    textAlign: "center",
  },
});
