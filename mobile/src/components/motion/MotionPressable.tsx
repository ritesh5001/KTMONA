import * as React from "react";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  SlideInDown,
  SlideInLeft,
  SlideInRight,
  SlideInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { motionDuration, motionSpring, type MotionPreset } from "../../lib/motion.config";
import { impactLight } from "../../utils/haptics";

export interface MotionPressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
  haptic?: boolean;
  preset?: MotionPreset;
  enterDelay?: number;
  /**
   * Run the entering animation on mount.
   *
   * Off is the right default for anything that can appear inside a virtualised
   * list: a layout animation on a cell that gets recycled or clipped mid-flight
   * is a documented Android native crash, and a button fading in every time it
   * scrolls back into view reads as jitter rather than polish. Turn it on only
   * for a button that genuinely appears in response to something.
   */
  animateEntrance?: boolean;
}

function getEntering(preset: MotionPreset, delay: number) {
  const easing = Easing.bezier(0.2, 0.0, 0.0, 1);
  const duration = motionDuration.normal;

  switch (preset) {
    case "scale":
      return ZoomIn.duration(duration).delay(delay).easing(easing);
    case "slideUp":
      return SlideInUp.duration(duration).delay(delay).easing(easing);
    case "slideDown":
      return SlideInDown.duration(duration).delay(delay).easing(easing);
    case "slideLeft":
      return SlideInLeft.duration(duration).delay(delay).easing(easing);
    case "slideRight":
      return SlideInRight.duration(duration).delay(delay).easing(easing);
    case "fade":
    default:
      return FadeIn.duration(duration).delay(delay).easing(easing);
  }
}

export const MotionPressable = React.memo(function MotionPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  pressScale = 0.965,
  haptic = true,
  preset = "fade",
  enterDelay = 0,
  animateEntrance = false,
  ...rest
}: MotionPressableProps) {
  const scale = useSharedValue(1);
  const entering = React.useMemo(
    () => (animateEntrance ? getEntering(preset, enterDelay) : undefined),
    [animateEntrance, preset, enterDelay]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: scale.value,
      },
    ],
  }));

  const handlePressIn = React.useCallback(
    (event: any) => {
      scale.value = withSpring(pressScale, motionSpring.soft);
      if (haptic) {
        impactLight();
      }
      onPressIn?.(event);
    },
    [haptic, onPressIn, pressScale, scale]
  );

  const handlePressOut = React.useCallback(
    (event: any) => {
      scale.value = withSpring(1, motionSpring.bouncy);
      onPressOut?.(event);
    },
    [onPressOut, scale]
  );

  // The two Animated.View wrappers sit between this component's parent and the
  // Pressable that carries `style`. Anything the PARENT lays out against — flex,
  // width, alignSelf — has to live on the outermost wrapper, or the wrapper
  // collapses to its content and the caller's sizing is silently ignored. That is
  // what squashed the bottom nav: four flex:1 items packed to the left.
  //
  // Sizing and alignment are kept apart on purpose. Both must be hoisted to the
  // wrapper, but only sizing means "let the parent decide how big I am" — and
  // only that justifies stretching the inner layers to 100%. Lumping `alignSelf`
  // in with the rest made a merely centred button claim its parent's full height:
  // that is what turned Proceed to checkout into a page-tall slab.
  const { sizingStyle, alignmentStyle } = React.useMemo(() => {
    const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
    const { flex, flexGrow, flexShrink, flexBasis, width, height, alignSelf } = flat;
    return {
      sizingStyle: {
        ...(flex !== undefined ? { flex } : {}),
        ...(flexGrow !== undefined ? { flexGrow } : {}),
        ...(flexShrink !== undefined ? { flexShrink } : {}),
        ...(flexBasis !== undefined ? { flexBasis } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      } as ViewStyle,
      alignmentStyle: (alignSelf !== undefined ? { alignSelf } : {}) as ViewStyle,
    };
  }, [style]);

  // Only stretch the inner layers when the caller actually asked to be sized by
  // its parent. Applying 100% inside a content-sized wrapper would collapse every
  // other MotionPressable in the app.
  //
  // Each axis is stretched independently. Applying both whenever *either* was
  // asked for is what made the express-checkout "Try Again" button a page-tall
  // gold slab: `width: "100%"` alone also forced `height: "100%"`, which Yoga
  // resolves against the available height of the auto-height wrapper — so the
  // button claimed the whole screen and pushed the error message it was meant to
  // sit under clean off the top of the view.
  //
  // A flex value still stretches both axes, because which one it sizes depends on
  // the parent's direction and we cannot see that from here — that is the bottom
  // nav case above, and it keeps working exactly as before.
  const hasFlex =
    sizingStyle.flex !== undefined ||
    sizingStyle.flexGrow !== undefined ||
    sizingStyle.flexShrink !== undefined ||
    sizingStyle.flexBasis !== undefined;
  const stretchWidth = hasFlex || sizingStyle.width !== undefined;
  const stretchHeight = hasFlex || sizingStyle.height !== undefined;
  const fillStyle = React.useMemo(
    () => ({
      ...(stretchWidth ? { width: "100%" as const } : {}),
      ...(stretchHeight ? { height: "100%" as const } : {}),
    }),
    [stretchWidth, stretchHeight]
  );
  const hasFill = stretchWidth || stretchHeight;
  const outerStyle = React.useMemo(
    () => ({ ...sizingStyle, ...alignmentStyle }),
    [sizingStyle, alignmentStyle]
  );
  const hasOuterStyle = Object.keys(outerStyle).length > 0;

  return (
    <Animated.View entering={entering} style={hasOuterStyle ? outerStyle : undefined}>
      <Animated.View style={[animatedStyle, hasFill && fillStyle]}>
        <Pressable
          {...rest}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[style, hasFill && fillStyle]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

