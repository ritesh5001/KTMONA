"use client";

import { ADS_ENABLED } from "@/lib/features";
import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  BadgeCheck,
  BadgePercent,
  BarChart3,
  Bell,
  Boxes,
  CalendarClock,
  Clapperboard,
  FileStack,
  Headset,
  Home,
  Images,
  Megaphone,
  Package,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  Wallet,
  Warehouse,
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
    // Same order and grouping as the Meesho supplier panel.
    () => [
      { href: "/seller/dashboard", label: "Home", icon: Home },
      {
        href: "/seller/orders",
        label: "Orders",
        icon: ShoppingBag,
        section: "Manage Business",
        badge: counts?.pending || undefined,
        tag: counts?.pending ? undefined : "New",
        children: [
          { href: "/seller/orders", label: "Manage Orders" },
          { href: "/seller/orders/dispatch-performance", label: "Dispatch Performance", tag: "New" },
        ],
      },
      { href: "/seller/returns", label: "Returns", icon: RotateCcw, section: "Manage Business" },
      {
        href: "/seller/pricing",
        label: "Pricing",
        icon: BadgePercent,
        section: "Manage Business",
        children: [
          { href: "/seller/pricing", label: "Manage Pricing" },
          { href: "/seller/pricing/reduce-rto", label: "Reduce RTOs & Returns" },
        ],
      },
      { href: "/seller/claims", label: "Claims", icon: ShieldCheck, section: "Manage Business" },
      { href: "/seller/inventory", label: "Inventory", icon: Boxes, section: "Manage Business" },
      { href: "/seller/catalog-uploads", label: "Catalog Uploads", icon: FileStack, section: "Manage Business" },
      { href: "/seller/image-bulk-upload", label: "Image Bulk Upload", icon: Images, section: "Manage Business" },
      { href: "/seller/quality", label: "Quality", icon: BadgeCheck, section: "Manage Business" },
      { href: "/seller/settlements", label: "Payments", icon: Wallet, section: "Manage Business" },
      { href: "/seller/warehouse", label: "Warehouse", icon: Warehouse, section: "Manage Business" },
      { href: "/seller/products", label: "My Products", icon: Package, section: "More" },
      { href: "/seller/sale-events", label: "Sale Events", icon: Tag, section: "More" },
      ...(ADS_ENABLED ? [{ href: "/seller/ads", label: "Ads", icon: Megaphone, section: "More" }] : []),
      { href: "/seller/performance", label: "Business Dashboard", icon: BarChart3, section: "More" },
      { href: "/seller/reels", label: "Reels", icon: Clapperboard, section: "More" },
      { href: "/seller/appointments", label: "Appointments", icon: CalendarClock, section: "More" },
      { href: "/seller/settings", label: "Settings", icon: Settings, section: "More" },
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
      showHelpCard={false}
      sidebarHeader={
        <div className="rounded-xl bg-sidebar-accent/60">
          <Link href="/seller/settings" className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
              <Store className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-accent-foreground">
              {settings?.store?.name ?? "My Store"}
            </span>
          </Link>
          <div className="grid grid-cols-2 border-t border-sidebar-border text-xs font-medium">
            <Link href="/seller/notifications" className="flex items-center justify-center gap-1.5 py-2 text-sidebar-foreground hover:text-sidebar-accent-foreground">
              <Bell className="h-3.5 w-3.5" /> Notices{unread ? ` (${unread})` : ""}
            </Link>
            <Link href="/seller/support" className="flex items-center justify-center gap-1.5 border-l border-sidebar-border py-2 text-sidebar-foreground hover:text-sidebar-accent-foreground">
              <Headset className="h-3.5 w-3.5" /> Support
            </Link>
          </div>
        </div>
      }
    >
      {children}
    </PanelShell>
  );
}
