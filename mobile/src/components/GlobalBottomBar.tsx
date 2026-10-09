import * as React from "react";
import { usePathname } from "expo-router";
import { StandaloneTabBar, TAB_BAR_HEIGHT } from "../ui/TabBar";

export const APP_BOTTOM_BAR_HEIGHT = TAB_BAR_HEIGHT;

export function getBottomBarTotalHeight(insetBottom: number): number {
  return APP_BOTTOM_BAR_HEIGHT + Math.max(insetBottom, 4);
}

const TAB_ROUTE_PREFIXES = [
  "/home",
  "/marketplace",
  "/reels",
  "/try-buy",
  "/search",
  "/profile",
  "/cart",
  "/wishlist",
  "/orders",
  "/notifications",
  "/categories",
  "/privacy-policy",
  "/return-policy",
  "/refund-policy",
  "/terms",
  "/contact",
];

function isTabRoute(pathname: string): boolean {
  return TAB_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Routes where the bottom bar should be hidden (focused flows with their own CTA). */
const HIDDEN_ROUTE_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/request-otp",
  "/verify-otp",
  "/reset-password",
  "/product",
  "/checkout",
  "/category",
];

export function shouldHideBottomBar(pathname: string): boolean {
  if (isTabRoute(pathname)) return true;
  return HIDDEN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Bottom navigation for stack screens outside the tab navigator (support,
 * order details). Tab screens draw their own bar.
 */
export function GlobalBottomBar() {
  const pathname = usePathname();
  if (shouldHideBottomBar(pathname)) return null;
  return <StandaloneTabBar />;
}
