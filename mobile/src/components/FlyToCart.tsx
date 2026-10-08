import * as React from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "./Icon";
import { colors } from "../theme/tokens";

/**
 * Flies a thumbnail of the product from the action bar up to the cart icon.
 *
 * Adding to a bag is otherwise invisible — a toast tells you it happened, but
 * nothing connects the thing you were looking at to the place it went. This
 * draws that line, which is what makes the action feel physical rather than
 * merely acknowledged.
 *
 * The header's cart button is a fixed position in the top-right on every screen,
 * so the target is derived from the safe area rather than measured. Measuring
 * across component boundaries would mean threading refs through AppHeader for a
 * result that never differs by more than a pixel or two.
 */
const FLIGHT_MS = 650;
const CART_ICON_INSET_RIGHT = 34;
const CART_ICON_FROM_TOP = 30;
/** Same diameter as the swipe handle. */
const HANDLE_SIZE = 58;

export function FlyToCart({
  imageUri,
  origin,
  onDone,
}: {
  /** Null clears the overlay; setting it starts a flight. */
  imageUri: string | null;
  /** Where the flight starts, in screen coordinates. */
  origin: { x: number; y: number } | null;
  onDone?: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const [flying, setFlying] = React.useState(false);

  const target = React.useMemo(
    () => ({
      x: windowWidth - CART_ICON_INSET_RIGHT,
      y: insets.top + CART_ICON_FROM_TOP,
    }),
    [windowWidth, insets.top]
  );

  const finish = React.useCallback(() => {
    setFlying(false);
    onDone?.();
  }, [onDone]);

  React.useEffect(() => {
    if (!imageUri || !origin) return;

    setFlying(true);
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: FLIGHT_MS, easing: Easing.bezier(0.35, 0, 0.2, 1) },
      (completed) => {
        if (completed) runOnJS(finish)();
      }
    );
  }, [imageUri, origin, progress, finish]);

  const style = useAnimatedStyle(() => {
    if (!origin) return { opacity: 0 };

    const t = progress.value;
    // Horizontal eases straight across while vertical lifts early, so the path
    // arcs upward instead of cutting a flat diagonal.
    const arc = Math.sin(t * Math.PI) * -70;
    const x = origin.x + (target.x - origin.x) * t;
    const y = origin.y + (target.y - origin.y) * t + arc;

    return {
      // Holds full opacity almost the whole way, then dissolves into the nav bar
      // rather than vanishing at an arbitrary point.
      opacity: t > 0.88 ? (1 - t) / 0.12 : 1,
      transform: [
        { translateX: x },
        { translateY: y },
        // 100% → 65%, per spec: it arrives smaller but still legible.
        { scale: 1 - 0.35 * t },
        { rotate: `${t * 16}deg` },
      ],
    };
  });

  if (!flying || !imageUri || !origin) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.flyer, style]}>
      <Animated.View style={styles.puck}>
        <Icon name="bag-handle" size={22} color={colors.warmWhite} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * A short pop for the cart icon, timed to land as the flyer arrives.
 * Exported so the header can consume the same easing.
 */
export function useCartArrivalPulse() {
  const scale = useSharedValue(1);

  const pulse = React.useCallback(() => {
    scale.value = withDelay(
      FLIGHT_MS - 120,
      withSequence(
        withTiming(1.28, { duration: 130, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 190, easing: Easing.elastic(1.6) })
      )
    );
  }, [scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { pulse, style };
}

const styles = StyleSheet.create({
  flyer: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 999,
    // Anchored top-left; translateX/Y place it in screen space.
    marginLeft: -HANDLE_SIZE / 2,
    marginTop: -HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
  },
  /** Matches the swipe handle exactly, so it reads as the same object. */
  puck: {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.charcoal,
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
});
