import type { TextStyle } from "react-native";

export const typography = {
  // Meesho-style storefront: clean sans headings instead of the old serif.
  heading: "Inter_600SemiBold",
  serif: "Inter_600SemiBold",
  serifLight: "Inter_500Medium",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sizes: {
    heroTitle: 28,
    sectionTitle: 22,
    pageTitle: 20,
    cardTitle: 18,
    productTitle: 16,
    bodyText: 15,
    caption: 12,
  },
} as const;

export const textStyles: Record<
  "header" | "sectionTitle" | "productTitle" | "bodyText" | "bodyTextSecondary",
  TextStyle
> = {
  header: {
    fontFamily: typography.heading,
    fontSize: typography.sizes.heroTitle,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontFamily: typography.heading,
    fontSize: typography.sizes.sectionTitle,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  productTitle: {
    fontFamily: typography.bodyMedium,
    fontSize: typography.sizes.productTitle,
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodyText: {
    fontFamily: typography.body,
    fontSize: typography.sizes.bodyText,
    lineHeight: 20,
    letterSpacing: 0,
  },
  bodyTextSecondary: {
    fontFamily: typography.body,
    fontSize: typography.sizes.bodyText,
    lineHeight: 20,
    letterSpacing: 0,
    opacity: 0.9,
  },
};
