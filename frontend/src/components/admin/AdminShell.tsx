"use client";

import * as React from "react";
import useSWR from "swr";
import {
  AlarmClock,
  Award,
  BadgePercent,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  Clapperboard,
  CreditCard,
  FileWarning,
  FolderTree,
  Gavel,
  Headset,
  LayoutDashboard,
  Megaphone,
  Package,
  Percent,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Undo2,
  UserRound,
  Wallet,
  Banknote,
  XCircle,
  BellRing,
  Bell, Images } from "lucide-react";
import { getUnreadCount } from "@/services/notifications";
import { getSessionRole } from "@/lib/session";
import { getStorefrontUrl } from "@/lib/subdomain";
import { adminCenter } from "@/services/admin-center";
import { PanelShell, type PanelNavItem } from "@/components/panel/PanelShell";

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

  // Action-center counts drive the sidebar badges.
  const { data: dash } = useSWR(["admin-dashboard", 30], () => adminCenter.dashboard(30), {
    refreshInterval: 2 * 60_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const count = (key: string) => dash?.actionCenter.find((a) => a.key === key)?.count || undefined;

  const navItems = React.useMemo<PanelNavItem[]>(
    () => [
      { section: "Operations", href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { section: "Operations", href: "/admin/sla", label: "Dispatch SLA", icon: AlarmClock, badge: count("sla") },
      { section: "Sellers & catalog", href: "/admin/sellers", label: "Sellers", icon: Store, badge: (count("sellers") ?? 0) + (count("kyc") ?? 0) || undefined },
      { section: "Sellers & catalog", href: "/admin/catalog-qc", label: "Catalog QC", icon: ClipboardCheck, badge: count("qc") },
      { section: "Sellers & catalog", href: "/admin/products", label: "Products & Pricing", icon: Package },
      { section: "Sellers & catalog", href: "/admin/moderation", label: "Moderation", icon: ShieldAlert },
      { section: "Sellers & catalog", href: "/admin/categories", label: "Categories", icon: FolderTree },
      { section: "Sellers & catalog", href: "/admin/occasions", label: "Collections", icon: Sparkles },
      { section: "Orders", href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { section: "Orders", href: "/admin/cancellations", label: "Cancellations", icon: XCircle, badge: count("cancellations") },
      { section: "Orders", href: "/admin/returns", label: "Returns", icon: Undo2, badge: count("returns") },
      { section: "Orders", href: "/admin/refunds", label: "Refunds", icon: RotateCcw },
      { section: "Orders", href: "/admin/seller-claims", label: "Seller Claims", icon: FileWarning, badge: count("claims") },
      { section: "Money", href: "/admin/payouts", label: "Payouts", icon: Banknote, badge: count("payouts") },
      { section: "Money", href: "/admin/penalties", label: "Penalties", icon: Gavel },
      { section: "Money", href: "/admin/payments", label: "Payments", icon: CreditCard },
      { section: "Money", href: "/admin/settlements", label: "Settlements", icon: Wallet },
      { section: "Money", href: "/admin/commissions", label: "Commissions", icon: Percent },
      { section: "Growth", href: "/admin/sale-events", label: "Sale Events", icon: Tag },
      { section: "Growth", href: "/admin/ads", label: "Ads", icon: Megaphone },
      { section: "Growth", href: "/admin/coupons", label: "Coupons", icon: BadgePercent },
      { section: "Growth", href: "/admin/bestsellers", label: "Bestsellers", icon: Award },
      { section: "Growth", href: "/admin/reels", label: "Reels", icon: Clapperboard },
      { section: "Growth", href: "/admin/reviews", label: "Reviews", icon: Star },
      { section: "Platform", href: "/admin/homepage", label: "Homepage Banners", icon: Images },
      { section: "Platform", href: "/admin/announcements", label: "Seller Notices", icon: BellRing },
      { section: "Platform", href: "/admin/notifications", label: "Notifications", icon: Bell },
      { section: "Platform", href: "/admin/support", label: "Support", icon: Headset },
      { section: "Platform", href: "/admin/appointments", label: "Appointments", icon: CalendarClock },
      { section: "Platform", href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { section: "Platform", href: "/admin/settings", label: "Settings", icon: Settings },
      { section: "Platform", href: "/admin/security", label: "Security", icon: ShieldCheck },
      { section: "Platform", href: "/admin/profile", label: "Profile", icon: UserRound },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dash]
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
      panelLabel="Admin Panel"
      roleLabel={roleLabel}
      navItems={navItems}
      notificationsHref="/admin/notifications"
      unreadCount={unread}
      supportHref="/admin/support"
      topLinks={topLinks}
      showHelpCard={false}
    >
      {children}
    </PanelShell>
  );
}
