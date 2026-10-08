"use client";

import * as React from "react";
import useSWR from "swr";
import {
  Award,
  BadgePercent,
  BarChart3,
  CalendarClock,
  Clapperboard,
  CreditCard,
  FileWarning,
  FolderTree,
  Headset,
  LayoutDashboard,
  Package,
  Percent,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Undo2,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { getUnreadCount } from "@/services/notifications";
import { getSessionRole } from "@/lib/session";
import { getStorefrontUrl } from "@/lib/subdomain";
import { PanelShell, type PanelNavItem } from "@/components/panel/PanelShell";

const NAV_ITEMS: PanelNavItem[] = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/sellers", label: "Sellers", icon: Store },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldAlert },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/occasions", label: "Occasions", icon: Sparkles },
  { href: "/admin/bestsellers", label: "Bestsellers", icon: Award },
  { href: "/admin/reels", label: "Reels", icon: Clapperboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/cancellations", label: "Cancellations", icon: XCircle },
  { href: "/admin/returns", label: "Returns", icon: Undo2 },
  { href: "/admin/seller-claims", label: "Seller Claims", icon: FileWarning },
  { href: "/admin/refunds", label: "Refunds", icon: RotateCcw },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/settlements", label: "Settlements", icon: Wallet },
  { href: "/admin/commissions", label: "Commissions", icon: Percent },
  { href: "/admin/coupons", label: "Coupons", icon: BadgePercent },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/admin/support", label: "Support", icon: Headset },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
  { href: "/admin/profile", label: "Profile", icon: UserRound },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [roleLabel, setRoleLabel] = React.useState("Admin");

  React.useEffect(() => {
    setRoleLabel(getSessionRole() === "SUPER_ADMIN" ? "Super Admin" : "Admin");
  }, []);

  const { data: unread = 0 } = useSWR("admin-unread-count", getUnreadCount, {
    refreshInterval: 5 * 60_000,
    dedupingInterval: 5 * 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

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
      panelLabel="Admin Panel"
      roleLabel={roleLabel}
      navItems={NAV_ITEMS}
      notificationsHref="/admin/notifications"
      unreadCount={unread}
      supportHref="/admin/support"
      topLinks={topLinks}
    >
      {children}
    </PanelShell>
  );
}
