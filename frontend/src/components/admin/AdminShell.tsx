"use client";

import { ADS_ENABLED } from "@/lib/features";
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
  Bell, Images,
  Briefcase,
  Handshake,
  History,
  Link2,
  Lock,
  Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { permissionForAdminPath, staffApi } from "@/services/platform";
import { getUnreadCount } from "@/services/notifications";
import { getSessionRole } from "@/lib/session";
import { getStorefrontUrl } from "@/lib/subdomain";
import { adminCenter } from "@/services/admin-center";
import { PanelShell, type PanelNavItem } from "@/components/panel/PanelShell";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [roleLabel, setRoleLabel] = React.useState("Admin");

  React.useEffect(() => {
    setRoleLabel(getSessionRole() === "SUPER_ADMIN" ? "Super Admin" : "Admin");
  }, []);

  // Which sections this account may use. Employees only see (and can only
  // call the API of) the sections an admin granted them.
  const { data: access } = useSWR("admin-my-access", staffApi.myAccess, {
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
  });
  React.useEffect(() => {
    if (access) setRoleLabel(access.roleLabel);
  }, [access]);
  const can = React.useCallback(
    (href: string) => {
      const required = permissionForAdminPath(href);
      if (!required) return true;
      // Until access loads, show everything rather than flash an empty menu;
      // the API refuses anything an employee may not use regardless.
      return !access || access.permissions.includes(required);
    },
    [access]
  );

  const { data: unread = 0 } = useSWR("admin-unread-count", getUnreadCount, {
    refreshInterval: 5 * 60_000,
    dedupingInterval: 5 * 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  // Action-center counts drive the sidebar badges.
  const { data: dash } = useSWR(access?.permissions.includes("dashboard") ? ["admin-dashboard", 30] : null, () => adminCenter.dashboard(30), {
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
      { section: "Sellers & catalog", href: "/admin/price-lock", label: "Price Lock", icon: Lock },
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
      ...(ADS_ENABLED ? [{ section: "Growth", href: "/admin/ads", label: "Ads", icon: Megaphone }] : []),
      { section: "Growth", href: "/admin/coupons", label: "Coupons", icon: BadgePercent },
      { section: "Growth", href: "/admin/bestsellers", label: "Bestsellers", icon: Award },
      { section: "Growth", href: "/admin/reels", label: "Reels", icon: Clapperboard },
      { section: "Growth", href: "/admin/reviews", label: "Reviews", icon: Star },
      { section: "Platform", href: "/admin/homepage", label: "Homepage Banners", icon: Images },
      { section: "Platform", href: "/admin/site-links", label: "App & Social Links", icon: Link2 },
      { section: "Platform", href: "/admin/careers", label: "Careers", icon: Briefcase },
      { section: "Platform", href: "/admin/investors", label: "Investor Enquiries", icon: Handshake },
      { section: "Platform", href: "/admin/announcements", label: "Seller Notices", icon: BellRing },
      { section: "Platform", href: "/admin/notifications", label: "Notifications", icon: Bell },
      { section: "Platform", href: "/admin/support", label: "Support", icon: Headset },
      { section: "Platform", href: "/admin/appointments", label: "Appointments", icon: CalendarClock },
      { section: "Platform", href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { section: "Platform", href: "/admin/settings", label: "Settings", icon: Settings },
      { section: "Platform", href: "/admin/security", label: "Security", icon: ShieldCheck },
      ...(access?.canManageEmployees === false
        ? []
        : [{ section: "Team", href: "/admin/employees", label: "Employees", icon: Users }]),
      { section: "Team", href: "/admin/activity-log", label: "Activity Log", icon: History },
      { section: "Team", href: "/admin/profile", label: "Profile", icon: UserRound },
    ].filter((item) => can(item.href)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dash, access, can]
  );

  const required = permissionForAdminPath(pathname);
  const blocked =
    Boolean(access?.isEmployee) &&
    ((required !== null && !access!.permissions.includes(required)) || pathname.startsWith("/admin/employees"));

  // Sign-in lands on the dashboard; an employee without it goes straight to
  // the first section they do have.
  const landing = navItems[0]?.href;
  React.useEffect(() => {
    if (blocked && pathname === "/admin/dashboard" && landing && landing !== pathname) {
      router.replace(landing);
    }
  }, [blocked, pathname, landing, router]);

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
      {blocked ? <NoAccess allowed={navItems} /> : children}
    </PanelShell>
  );
}

/** Shown to an employee who opens a section they were not given. */
function NoAccess({ allowed }: { allowed: PanelNavItem[] }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold">You don&apos;t have access to this section</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your employee account can use the sections below. Ask an admin if you need access to more.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {allowed.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-border-soft px-3 py-2 text-sm font-medium hover:bg-mist"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
