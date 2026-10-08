"use client";

import * as React from "react";
import useSWR from "swr";
import {
  BadgePercent,
  BarChart3,
  Boxes,
  CalendarClock,
  Clapperboard,
  Headset,
  LayoutDashboard,
  Megaphone,
  Package,
  PlusCircle,
  RotateCcw,
  Settings,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { getUnreadCount } from "@/services/notifications";
import { sellerCenter } from "@/services/seller-center";
import { getStorefrontUrl } from "@/lib/subdomain";
import { PanelShell, type PanelNavItem } from "@/components/panel/PanelShell";

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

  // Pending-orders badge. Pages that act on orders mutate this key.
  const { data: counts } = useSWR("seller-order-counts", () => sellerCenter.orderCounts(), {
    refreshInterval: 2 * 60_000,
    dedupingInterval: 60_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  // Store name + seller ID for the top bar.
  const { data: settings } = useSWR("seller-settings", () => sellerCenter.settings(), {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
  });

  const navItems = React.useMemo<PanelNavItem[]>(
    () => [
      { href: "/seller/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/seller/products", label: "My Products", icon: Package },
      { href: "/seller/products/new", label: "Add Product", icon: PlusCircle },
      { href: "/seller/orders", label: "Orders", icon: ShoppingBag, badge: counts?.pending || undefined },
      { href: "/seller/returns", label: "Returns & Refunds", icon: RotateCcw },
      { href: "/seller/inventory", label: "Inventory", icon: Boxes },
      { href: "/seller/pricing", label: "Pricing & Offers", icon: BadgePercent },
      { href: "/seller/settlements", label: "Payments", icon: Wallet },
      { href: "/seller/ads", label: "Ads", icon: Megaphone },
      { href: "/seller/performance", label: "Performance", icon: BarChart3 },
      { href: "/seller/reels", label: "Reels", icon: Clapperboard },
      { href: "/seller/appointments", label: "Appointments", icon: CalendarClock },
      { href: "/seller/support", label: "Seller Support", icon: Headset },
      { href: "/seller/settings", label: "Settings", icon: Settings },
    ],
    [counts?.pending]
  );

  // Storefront URLs depend on the current host (window), so resolve them after
  // mount; rendering them on the server caused a hydration mismatch.
  const [topLinks, setTopLinks] = React.useState([
    { href: "/", label: "Visit Store" },
    { href: "/marketplace", label: "Marketplace" },
  ]);
  React.useEffect(() => {
    setTopLinks([
      { href: getStorefrontUrl("home"), label: "Visit Store" },
      { href: getStorefrontUrl("shop"), label: "Marketplace" },
    ]);
  }, []);

  return (
    <PanelShell
      panelLabel="Seller Panel"
      roleLabel="Seller"
      navItems={navItems}
      notificationsHref="/seller/notifications"
      unreadCount={unread}
      supportHref="/seller/support"
      topLinks={topLinks}
      accountName={settings?.store?.name ?? null}
      accountSub={settings ? `Seller ID: ${settings.sellerCode}` : null}
    >
      {children}
    </PanelShell>
  );
}
