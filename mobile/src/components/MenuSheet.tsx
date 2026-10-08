import * as React from "react";
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  useWindowDimensions,
  AccessibilityInfo,
  findNodeHandle,
  Platform,
} from "react-native";
import { usePathname, useRouter } from "expo-router";
// The drawer slide stays on RN Animated so it keeps the native driver that
// stopped it freezing; reanimated handles only the per-row entrance and press
// states. Both are imported under distinct names to keep that split obvious.
import Reanimated, {
  FadeInLeft,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Icon, type IconName } from "./Icon";
import { ProfileAvatar } from "./ProfileAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography, radius } from "../theme/tokens";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../providers/ToastProvider";

interface MenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onNavigate?: (route: string) => void;
  items?: { label: string; route: string }[];
}

const baseItems: { label: string; route: string }[] = [
  { label: "Home", route: "/home" },
  { label: "Marketplace", route: "/marketplace" },
  { label: "Reels", route: "/reels" },
  { label: "Search", route: "/search" },
];

const MENU_ICON_BY_ROUTE: Record<string, IconName> = {
  "/home": "home-outline",
  "/marketplace": "bag-handle-outline",
  "/reels": "videocam-outline",
  "/search": "search-outline",
  "/cart": "cart-outline",
  "/orders": "receipt-outline",
  "/wishlist": "heart-outline",
  "/profile": "person-outline",
  "/contact": "headset-outline",
  "/support": "headset-outline",
  "/login": "log-in-outline",
  "/register": "person-add-outline",
  "__logout__": "log-out-outline",
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const ReanimatedView = Reanimated.View;
const ReanimatedPressable = Reanimated.createAnimatedComponent(Pressable);

/**
 * One navigation row.
 *
 * No disc behind the glyph. A circle around every icon turns a navigation list
 * into a row of buttons competing for attention, and eleven of them stacked
 * down a drawer is visual noise — the label is already the target. The mark sits
 * on its own and the row carries the interaction instead.
 *
 * Pressing slides the whole row a few points to the right, as though it is being
 * drawn toward where it will take you, while a gold rule grows down the leading
 * edge. That edge is also the resting state of the active route, so the press
 * previews arriving rather than inventing an unrelated effect.
 *
 * Rows arrive on a short stagger so the drawer assembles itself. The stagger is
 * safe here in a way it is not in a product list: this Modal mounts fresh on
 * every open and nothing inside it is ever recycled.
 */
const MenuRow = React.memo(function MenuRow({
  label,
  icon,
  index,
  active,
  destructive,
  disabled,
  onPress,
}: {
  label: string;
  icon: IconName;
  index: number;
  active: boolean;
  destructive: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const press = useSharedValue(0);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 5 * press.value }],
    backgroundColor: `rgba(255, 138, 0, ${0.09 * press.value})`,
  }));

  /** The leading rule: full height when active, growing from nothing on press. */
  const edgeStyle = useAnimatedStyle(() => ({
    opacity: active ? 1 : press.value,
    transform: [{ scaleY: active ? 1 : 0.3 + 0.7 * press.value }],
  }));

  const accent = destructive ? colors.error : colors.gold;
  const restingTint = destructive
    ? colors.error
    : active
      ? colors.gold
      : colors.charcoal;

  // Icon-font colour cannot be interpolated on the UI thread, so the warm copy
  // fades up over the resting one.
  const restingGlyphStyle = useAnimatedStyle(() => ({
    opacity: active ? 0 : 1 - press.value,
  }));
  const warmGlyphStyle = useAnimatedStyle(() => ({
    opacity: active ? 1 : press.value,
  }));

  return (
    <ReanimatedView
      entering={FadeInLeft
        .duration(260)
        .delay(60 + index * 26)
        .reduceMotion(ReduceMotion.System)}
    >
      <ReanimatedPressable
        style={[menuRowStyles.row, disabled && menuRowStyles.rowDisabled, rowStyle]}
        onPressIn={() => {
          press.value = withTiming(1, { duration: 110 });
        }}
        onPressOut={() => {
          press.value = withSpring(0, { damping: 17, stiffness: 230, mass: 0.65 });
        }}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={disabled && destructive ? "Logging out" : label}
        accessibilityHint={
          destructive ? "Signs out of your account" : `Opens ${label}`
        }
        accessibilityState={{ disabled, selected: active }}
      >
        <ReanimatedView
          style={[menuRowStyles.edge, { backgroundColor: accent }, edgeStyle]}
          pointerEvents="none"
        />

        <View style={menuRowStyles.glyph}>
          <ReanimatedView style={[menuRowStyles.glyphLayer, restingGlyphStyle]}>
            <Icon name={icon} size={17} color={restingTint} />
          </ReanimatedView>
          <ReanimatedView
            style={[menuRowStyles.glyphLayer, warmGlyphStyle]}
            pointerEvents="none"
          >
            <Icon name={icon} size={17} color={accent} />
          </ReanimatedView>
        </View>

        <Text
          style={[
            menuRowStyles.label,
            active && menuRowStyles.labelActive,
            destructive && menuRowStyles.labelDestructive,
          ]}
        >
          {label}
        </Text>
      </ReanimatedPressable>
    </ReanimatedView>
  );
});

const menuRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: spacing.md,
    paddingVertical: 13,
    // Leaves room for the leading rule without the label shifting when it appears.
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  /** The leading edge: active state and press feedback in one mark. */
  edge: {
    position: "absolute",
    left: 0,
    top: 9,
    bottom: 9,
    width: 2,
    borderRadius: radius.pill,
  },
  /** Sized so the two stacked tint copies overlay exactly. */
  glyph: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  glyphLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  label: {
    flex: 1,
    fontFamily: typography.sans,
    fontSize: 14.5,
    letterSpacing: 0.3,
    color: colors.charcoal,
  },
  labelActive: {
    fontFamily: typography.sansMedium,
    color: colors.gold,
  },
  labelDestructive: {
    color: colors.error,
  },
});

export function MenuSheet({ visible, onClose, onNavigate, items }: MenuSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(340, Math.round(windowWidth * 0.82));
  const { session, signOut } = useAuth();
  const { showToast } = useToast();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const logoutLockRef = React.useRef(false);
  const closeButtonRef = React.useRef<React.ElementRef<typeof Pressable>>(null);
  const openedAtRef = React.useRef(0);
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const drawerTranslateX = React.useRef(new Animated.Value(-drawerWidth)).current;

  const normalizeRoute = React.useCallback((route: string) => {
    if (route.startsWith("/(tabs)/")) {
      return `/${route.slice("/(tabs)/".length)}`;
    }
    if (route.startsWith("/(auth)/")) {
      return `/${route.slice("/(auth)/".length)}`;
    }
    return route;
  }, []);

  const menuItems = React.useMemo(() => {
    if (items) return items;
    if (session?.user) {
      return [
        ...baseItems,
        { label: "Cart", route: "/cart" },
        { label: "Orders", route: "/orders" },
        { label: "Wishlist", route: "/wishlist" },
        { label: "Profile", route: "/profile" },
        { label: "Support", route: "/support" },
        { label: "Logout", route: "__logout__" },
      ];
    }
    return [
      ...baseItems,
      { label: "Sign in", route: "/login" },
      { label: "Create account", route: "/register" },
    ];
  }, [items, session?.user]);

  const handleNavigate = React.useCallback(
    async (route: string) => {
      if (route === "__logout__") {
        if (loggingOut || logoutLockRef.current) return;
        logoutLockRef.current = true;
        setLoggingOut(true);
        try {
          await signOut();
          showToast("Signed out successfully", "success");
          onClose();
          router.push("/home");
        } finally {
          logoutLockRef.current = false;
          setLoggingOut(false);
        }
        return;
      }
      const nextRoute = normalizeRoute(route);
      onClose();
      if (onNavigate) {
        onNavigate(nextRoute);
      } else {
        router.push(nextRoute as any);
      }
    },
    [loggingOut, normalizeRoute, onNavigate, onClose, router, signOut, showToast]
  );

  const closeMenu = React.useCallback(() => {
    if (loggingOut) return;
    onClose();
  }, [loggingOut, onClose]);

  const handleOverlayPress = React.useCallback(() => {
    // Ignore the first overlay tap right after open to avoid same-tap close.
    if (Date.now() - openedAtRef.current < 260) {
      return;
    }
    closeMenu();
  }, [closeMenu]);

  const handleModalShow = React.useCallback(() => {
    AccessibilityInfo.announceForAccessibility("Navigation menu opened");
    requestAnimationFrame(() => {
      if (Platform.OS === "web") {
        const webButton = closeButtonRef.current as unknown as {
          focus?: () => void;
        } | null;
        webButton?.focus?.();
        return;
      }

      const node = findNodeHandle(closeButtonRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, []);

  // The modal outlives `visible` by the length of the exit animation. Without
  // this the drawer vanished instantly on close while the overlay faded, which
  // is the single cheapest-looking moment in a navigation drawer.
  const [isMounted, setIsMounted] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setIsMounted(true);
      openedAtRef.current = Date.now();
      overlayOpacity.setValue(0);
      drawerTranslateX.setValue(-drawerWidth);

      // Native driver, not JS. Driving translateX from JavaScript meant the slide
      // shared a thread with whatever render the tap had just kicked off, so a
      // busy frame left the drawer parked half off-screen with its labels
      // clipped — the "stuck menu". On the native driver it cannot be starved.
      const enter = Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drawerTranslateX, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      enter.start();
      // Reopening mid-flight used to leave the drawer wherever it had got to.
      return () => enter.stop();
    }

    if (!isMounted) return;

    const exit = Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(drawerTranslateX, {
        toValue: -drawerWidth,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    exit.start(({ finished }) => {
      if (finished) setIsMounted(false);
    });

    return () => exit.stop();
    // isMounted drives the exit run once; re-running on its own change would
    // restart the animation it just finished.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerTranslateX, drawerWidth, overlayOpacity, visible]);

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      onRequestClose={closeMenu}
      statusBarTranslucent
      onShow={handleModalShow}
    >
      <View style={styles.modalRoot}>
        <AnimatedPressable
          style={[styles.overlay, { opacity: overlayOpacity }]}
          onPress={handleOverlayPress}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel="Navigation menu"
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              paddingTop: Math.max(insets.top, spacing.lg),
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              transform: [{ translateX: drawerTranslateX }],
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <View style={styles.brandBlock}>
              <Text style={styles.title} accessibilityRole="header">
                KTMONA
              </Text>
              <View style={styles.brandRule} />
            </View>

            <Pressable
              ref={closeButtonRef}
              onPress={closeMenu}
              style={styles.closeIconButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close navigation menu"
            >
              <Icon name="close" size={17} color={colors.charcoal} />
            </Pressable>
          </View>

          {/* Who you are, when the app knows. A drawer that opens on a bare list
              of links tells the shopper nothing about their own session. */}
          {session?.user ? (
            <Pressable
              style={styles.accountRow}
              onPress={() => handleNavigate("/profile")}
              accessibilityRole="button"
              accessibilityLabel={`Open profile for ${session.user.fullName ?? session.user.email ?? "your account"}`}
            >
              {/* Read-only here — the drawer shows who you are; changing the
                  picture belongs on the profile screen where the change has
                  somewhere to land. */}
              <ProfileAvatar size={44} />
              <View style={styles.accountText}>
                <Text style={styles.accountName} numberOfLines={1}>
                  {session.user.fullName ?? "Your account"}
                </Text>
                {session.user.email ? (
                  <Text style={styles.accountEmail} numberOfLines={1}>
                    {session.user.email}
                  </Text>
                ) : null}
              </View>
              <Icon name="chevron-forward" size={16} color={colors.brownSoft} />
            </Pressable>
          ) : null}

          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuList}
            showsVerticalScrollIndicator={false}
          >
            {menuItems.map((item, index) => {
              const isLogout = item.route === "__logout__";
              const normalizedItemRoute = normalizeRoute(item.route);
              const active =
                !isLogout &&
                (pathname === normalizedItemRoute ||
                  (normalizedItemRoute !== "/home" &&
                    pathname.startsWith(`${normalizedItemRoute}/`)));

              return (
                <MenuRow
                  key={item.route}
                  label={item.label}
                  icon={MENU_ICON_BY_ROUTE[item.route] ?? "chevron-forward"}
                  index={index}
                  active={active}
                  destructive={isLogout}
                  disabled={isLogout && loggingOut}
                  onPress={() => handleNavigate(item.route)}
                />
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-start",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  drawer: {
    height: "100%",
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.lg,
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
    shadowColor: colors.charcoal,
    shadowOpacity: 0.2,
    shadowOffset: { width: 8, height: 0 },
    shadowRadius: 16,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  title: {
    fontFamily: typography.serif,
    fontSize: 24,
    color: colors.charcoal,
    lineHeight: 26,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.3,
    color: colors.brownSoft,
  },
  brandBlock: {
    gap: spacing.sm,
  },
  /** A short gold rule under the wordmark — the house mark, not a caption. */
  brandRule: {
    width: 34,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.goldDecorative,
  },
  /** Bare, like the rest of the drawer's marks — no disc. */
  closeIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warmWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
    minHeight: 64,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(196, 167, 108, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(196, 167, 108, 0.4)",
  },
  accountInitial: {
    fontFamily: typography.serif,
    fontSize: 19,
    lineHeight: 23,
    color: colors.gold,
  },
  accountText: {
    flex: 1,
  },
  accountName: {
    fontFamily: typography.sansMedium,
    fontSize: 13.5,
    color: colors.charcoal,
  },
  accountEmail: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
  },
  menuScroll: {
    flex: 1,
  },
  menuList: {
    gap: 2,
    paddingBottom: spacing.lg,
  },
});
