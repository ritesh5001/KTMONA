/**
 * Haptic feedback utilities — thin wrapper around expo-haptics.
 * Every helper is web-safe: silently no-ops on unsupported platforms.
 */
import { Platform } from "react-native";

// Lazy-load so the module never throws on web/SSR
let Haptics: typeof import("expo-haptics") | null = null;

if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Haptics = require("expo-haptics");
  } catch {
    // expo-haptics not installed — silently degrade
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Light tap — button presses, chip selects, pull-to-refresh start. */
export function impactLight(): void {
  try {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // no-op
  }
}

/** Medium tap — add-to-cart, quantity change, variant select. */
export function impactMedium(): void {
  try {
    // Keep haptics soft and consistent across the app.
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // no-op
  }
}

/** Success notification — checkout complete, review submitted, delivered. */
export function notifySuccess(): void {
  try {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // no-op
  }
}

/** Error notification — payment failed, network error toast. */
export function notifyError(): void {
  try {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // no-op
  }
}
