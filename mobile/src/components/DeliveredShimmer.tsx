/**
 * DeliveredShimmer — a subtle gold opacity pulse applied to child content
 * when an order is marked as DELIVERED.
 *
 * Uses Animated.loop with useNativeDriver. The animation is stopped and
 * cleaned up on unmount automatically.
 */
import * as React from "react";
import { Animated, type ViewStyle, type StyleProp } from "react-native";

interface DeliveredShimmerProps {
  /** Whether to animate. When false the children render without animation. */
  active: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const DeliveredShimmer = React.memo(function DeliveredShimmer({
  active,
  style,
  children,
}: DeliveredShimmerProps) {
  const opacityAnim = React.useRef(new Animated.Value(1)).current;
  const animRef = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    if (!active) {
      // Reset to static
      opacityAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );

    animRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
      animRef.current = null;
    };
  }, [active, opacityAnim]);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <Animated.View style={[style, { opacity: opacityAnim }]}>
      {children}
    </Animated.View>
  );
});
