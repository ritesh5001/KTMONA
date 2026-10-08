/**
 * KTMONA palette — navy + orange, taken from the KTMONA logo.
 * Mirrors the web tokens in frontend/src/app/globals.css.
 */
export const luxuryTheme = {
  background: "#F5F7FB",
  /** KTMONA navy — headers, primary surfaces. */
  dark: "#0C1B42",
  /** Logo orange. Decorative fills and large accents; too light for small text. */
  accent: "#FF8A00",
  /** AA-safe orange for text, focus rings, and interactive surfaces. */
  accentStrong: "#B84A00",
  onAccent: "#FFFFFF",
  textPrimary: "#0C1B42",
  textSecondary: "#55607A",
  border: "#E3E8F1",
  /** 3:1 against the app background for identifiable form controls. */
  borderStrong: "#7D88A3",
  shadow: "#0C1B42",
  card: "#FFFFFF",
  muted: "#EEF2F9",
  media: "#000000",
  success: "#15803D",
  warning: "#A15C00",
  error: "#B42318",
  overlay: "rgba(7, 15, 38, 0.6)",
  transparent: "transparent",
} as const;

export type LuxuryTheme = typeof luxuryTheme;
