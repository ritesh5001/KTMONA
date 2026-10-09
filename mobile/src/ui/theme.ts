/**
 * Storefront design tokens for the Meesho-style shopping screens.
 * KTMONA navy and orange replace Meesho's purple; layout, density and type
 * scale follow the Meesho app.
 */
export const C = {
  /** Logo orange: decorative marks only (too light for text or white-on-orange). */
  brand: "#FF8A00",
  /** Accessible orange (5.2:1 on white) for buttons, links and active labels. */
  brandDark: "#B84A00",
  brandSoft: "#FFF1E0",
  navy: "#0C1B42",
  navySoft: "#E8ECF7",
  bg: "#F4F5F9",
  card: "#FFFFFF",
  text: "#1F2937",
  textSoft: "#4B5563",
  muted: "#6B7280",
  faint: "#6F7684",
  border: "#E5E7EB",
  divider: "#EEF0F4",
  green: "#047857",
  greenBadge: "#047857",
  red: "#DC2626",
  white: "#FFFFFF",
  overlay: "rgba(12,27,66,0.45)",
} as const;

export const F = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const S = {
  page: 12,
  gap: 8,
} as const;

/** Category colours for tiles that have no photo. */
export const CATEGORY_TINT: Record<string, string> = {
  "kurti-saree": "#FCE7F3",
  "women-western": "#EDE9FE",
  lingerie: "#FFE4E6",
  men: "#DBEAFE",
  "kids-toys": "#FEF3C7",
  "home-kitchen": "#FFEDD5",
  "beauty-health": "#FCE7F3",
  "jewellery-accessories": "#FEF9C3",
  "bags-footwear": "#E0E7FF",
  electronics: "#E0F2FE",
  watches: "#F1F5F9",
  electricals: "#FEF3C7",
  "sports-fitness": "#DCFCE7",
  "car-motorbike": "#E2E8F0",
  "office-supplies-stationery": "#E0F2FE",
  grocery: "#DCFCE7",
  books: "#FFEDD5",
  "pet-supplies": "#FEF3C7",
  "musical-instruments": "#F3E8FF",
};

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Absolute fill as a plain style object (for components typed as ImageStyle). */
export const FILL = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;
