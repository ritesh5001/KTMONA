"use client";

import * as React from "react";
import useSWR from "swr";
import {
  BarChart3,
  CalendarClock,
  Clapperboard,
  Headset,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  Wallet,
} from "lucide-react";
import { getUnreadCount } from "@/services/notifications";
import { getStorefrontUrl } from "@/lib/subdomain";
import { PanelShell, type PanelNavItem } from "@/components/panel/PanelShell";

const NAV_ITEMS: PanelNavItem[] = [
  { href: "/seller/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/seller/products", label: "My Products", icon: Package },
  { href: "/seller/orders", label: "Orders", icon: ShoppingBag },
  { href: "/seller/reels", label: "Reels", icon: Clapperboard },
  { href: "/seller/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/seller/settlements", label: "Payments", icon: Wallet },
  { href: "/seller/analytics", label: "Performance", icon: BarChart3 },
  { href: "/seller/support", label: "Seller Support", icon: Headset },
  { href: "/seller/profile", label: "Store Settings", icon: Store },
];

export function SellerShell({ children }: { children: React.ReactNode }) {
  // Shared SWR key with a 5-minute dedupe: the shell mounts on every seller
  // page, so a per-mount fetch plus a 60s poll meant a badge request on every
  // navigation and one a minute forever, for a number that rarely changes.
  // The notifications page mutates this same key when items are read.
  const { data: unread = 0 } = useSWR("seller-unread-count", getUnreadCount, {
    refreshInterval: 5 * 60_000,
    dedupingInterval: 5 * 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const topLinks = React.useMemo(
    () => [
      { href: getStorefrontUrl("home"), label: "Visit Store" },
      { href: getStorefrontUrl("shop"), label: "Marketplace" },
    ],
    []
  );

  return (
    <PanelShell
      panelLabel="Seller Panel"
      roleLabel="Seller"
      navItems={NAV_ITEMS}
      notificationsHref="/seller/notifications"
      unreadCount={unread}
      supportHref="/seller/support"
      topLinks={topLinks}
    >
      {children}
    </PanelShell>
  );
}
