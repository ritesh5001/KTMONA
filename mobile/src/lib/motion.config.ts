import { Easing } from "react-native-reanimated";

export const motionDuration = {
  fast: 180,
  normal: 280,
  slow: 420,
} as const;

export const motionEasing = {
  standard: Easing.bezier(0.2, 0.0, 0.0, 1),
  smooth: Easing.bezier(0.24, 1, 0.32, 1),
  inOut: Easing.inOut(Easing.cubic),
} as const;

export const motionSpring = {
  soft: {
    damping: 18,
    stiffness: 200,
    mass: 0.9,
  },
  bouncy: {
    damping: 14,
    stiffness: 240,
    mass: 0.9,
  },
  snappy: {
    damping: 22,
    stiffness: 320,
    mass: 0.8,
  },
} as const;

export const motionFade = {
  from: { opacity: 0 },
  to: { opacity: 1 },
};

export const motionScale = {
  from: { opacity: 0, scale: 0.96 },
  to: { opacity: 1, scale: 1 },
};

export const motionSlide = {
  up: {
    from: { opacity: 0, translateY: 16 },
    to: { opacity: 1, translateY: 0 },
  },
  down: {
    from: { opacity: 0, translateY: -14 },
    to: { opacity: 1, translateY: 0 },
  },
  left: {
    from: { opacity: 0, translateX: 16 },
    to: { opacity: 1, translateX: 0 },
  },
  right: {
    from: { opacity: 0, translateX: -16 },
    to: { opacity: 1, translateX: 0 },
  },
};

export type MotionPreset = "fade" | "scale" | "slideUp" | "slideDown" | "slideLeft" | "slideRight";

export function getMotionPreset(preset: MotionPreset) {
  switch (preset) {
    case "fade":
      return motionFade;
    case "scale":
      return motionScale;
    case "slideDown":
      return motionSlide.down;
    case "slideLeft":
      return motionSlide.left;
    case "slideRight":
      return motionSlide.right;
    case "slideUp":
    default:
      return motionSlide.up;
  }
}
