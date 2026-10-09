"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Bell, ChevronDown, Headset, LogOut, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionUser } from "@/lib/session";
import { signOut } from "@/services/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";

export interface PanelNavChild {
  href: string;
  label: string;
  /** Small pill after the label, e.g. "NEW". */
  tag?: string;
}

export interface PanelNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Small pill after the label, e.g. "NEW". */
  tag?: string;
  /** Group heading shown above the first item of each section. */
  section?: string;
  /** Collapsible sub-menu (Meesho-style "Orders › Manage Orders"). */
  children?: PanelNavChild[];
}

interface PanelShellProps {
  /** Label under the logo, e.g. "Seller Panel". */
  panelLabel: string;
  /** Shown under the account name, e.g. "Seller" / "Super Admin". */
  roleLabel: string;
  navItems: PanelNavItem[];
  notificationsHref: string;
  unreadCount?: number;
  supportHref: string;
  /** Extra links rendered in the top bar (e.g. storefront shortcuts). */
  topLinks?: { href: string; label: string }[];
  /** Overrides the signed-in email in the top bar (e.g. store name). */
  accountName?: string | null;
  /** Second line under the account name (defaults to the role label). */
  accountSub?: string | null;
  /** "Need help?" card at the bottom of the sidebar (sellers only). */
  showHelpCard?: boolean;
  /** Rendered under the logo, above the nav (e.g. store switcher, quick links). */
  sidebarHeader?: React.ReactNode;
  children: React.ReactNode;
}

function NavTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="ktm-keep-case rounded bg-pink-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">{children}</span>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * KTMONA dashboard chrome shared by the seller and admin panels: navy sidebar
 * with the brand mark, orange active state, a top bar with page search,
 * notifications and the signed-in account.
 */
export function PanelShell({
  panelLabel,
  roleLabel,
  navItems,
  notificationsHref,
  unreadCount = 0,
  supportHref,
  topLinks = [],
  accountName,
  accountSub,
  showHelpCard = true,
  sidebarHeader,
  children,
}: PanelShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [account, setAccount] = React.useState<string>("");

  React.useEffect(() => {
    const user = getSessionUser<{ email?: string | null; phone?: string | null }>();
    setAccount(user?.email ?? user?.phone ?? "");
  }, []);

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => {
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Parents and sub-menu entries, flattened for search and active matching.
  const flatItems = React.useMemo(
    () =>
      navItems.flatMap((item) => [
        item,
        ...(item.children ?? []).map((child) => ({ ...child, icon: item.icon, parent: item.href })),
      ]),
    [navItems]
  );

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    return flatItems
      .filter((item) => item.label.toLowerCase().includes(q))
      .filter((item) => (seen.has(item.href) ? false : (seen.add(item.href), true)))
      .slice(0, 6);
  }, [flatItems, query]);

  const onSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (matches[0]) {
      router.push(matches[0].href);
      setQuery("");
    }
  };

  // Highlight only the most specific matching item (e.g. "Add Product" on
  // /seller/products/new, not "My Products" as well).
  const activeHref = React.useMemo(
    () =>
      flatItems
        .filter((item) => isActivePath(pathname, item.href))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null,
    [flatItems, pathname]
  );

  // Groups the user opened; the group holding the active page is always open.
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});
  const groupActive = (item: PanelNavItem) => Boolean(item.children?.some((c) => c.href === activeHref));

  const displayName = accountName || account || roleLabel;
  const initial = displayName.charAt(0).toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Link href={navItems[0]?.href ?? "/"} className="block">
          <Image
            src="/ktmona-logo-light.webp"
            alt="KTMONA"
            width={184}
            height={36}
            className="h-8 w-auto"
            priority
          />
          <span className="mt-1.5 block text-xs font-medium tracking-wide text-sidebar-foreground/80">
            {panelLabel}
          </span>
        </Link>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {sidebarHeader ? <div className="px-3 pb-2">{sidebarHeader}</div> : null}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label={panelLabel}>
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const heading = item.section && item.section !== navItems[index - 1]?.section ? item.section : null;
          const hasChildren = Boolean(item.children?.length);
          const inGroup = hasChildren && groupActive(item);
          const open = hasChildren && (openGroups[item.href] ?? inGroup);
          const active = !hasChildren && item.href === activeHref;
          const rowCls = (on: boolean) =>
            cn(
              "group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors",
              on
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_6px_16px_rgba(255,138,0,0.25)]"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            );
          const trailing = (on: boolean) => (
            <>
              {item.tag ? <NavTag>{item.tag}</NavTag> : null}
              {item.badge ? (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                    on ? "bg-ink text-paper" : "bg-brand text-ink"
                  )}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </>
          );
          return (
            <React.Fragment key={item.href}>
            {heading ? (
              <p className="ktm-keep-case px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 first:pt-1">{heading}</p>
            ) : null}
            {hasChildren ? (
              <div>
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [item.href]: !open }))}
                  aria-expanded={open}
                  className={cn(rowCls(false), inGroup && "text-sidebar-accent-foreground")}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {trailing(false)}
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
                </button>
                {open ? (
                  <div className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                    {item.children!.map((child) => {
                      const on = child.href === activeHref;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors",
                            on
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <span className="flex-1 truncate">{child.label}</span>
                          {child.tag ? <NavTag>{child.tag}</NavTag> : null}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={rowCls(active)}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className="flex-1 truncate">{item.label}</span>
              {trailing(active)}
            </Link>
            )}
            </React.Fragment>
          );
        })}
      </nav>

      {showHelpCard ? (
      <div className="px-4 pb-5">
        <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent p-4">
          <Headset className="h-6 w-6 text-brand" strokeWidth={1.8} />
          <p className="mt-3 text-sm font-semibold text-sidebar-accent-foreground">Need Help?</p>
          <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground">
            Our KTMONA support team is here for you.
          </p>
          <Link
            href={supportHref}
            className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand text-sm font-semibold text-ink transition-colors hover:bg-brand-light"
          >
            Contact Support
          </Link>
        </div>
      </div>
      ) : null}
    </div>
  );

  return (
    <div className="ktm-panel min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">{sidebar}</aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border-soft bg-card/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-mist lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <form onSubmit={onSearchSubmit} className="relative hidden max-w-xl flex-1 md:block" role="search">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, e.g. orders, payments…"
                aria-label="Search panel pages"
                className="h-10 w-full rounded-xl border border-border-soft bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {matches.length > 0 ? (
                <ul className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-border-soft bg-popover py-1 shadow-lg">
                  {matches.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setQuery("")}
                          className="flex items-center gap-3 px-3 py-2 text-sm text-popover-foreground hover:bg-accent"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </form>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {topLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener"
                  className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-mist hover:text-foreground xl:inline-flex"
                >
                  {link.label}
                </a>
              ))}
              <ThemeToggle className="rounded-lg" />
              <Link
                href={notificationsHref}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-mist"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              >
                <Bell className="h-5 w-5" strokeWidth={1.8} />
                {unreadCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-dark px-1 text-[10px] font-bold tabular-nums text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-mist"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper dark:bg-brand dark:text-ink">
                    {initial}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-40 truncate text-sm font-semibold text-foreground">
                      {displayName}
                    </span>
                    <span className="block text-xs text-muted-foreground">{accountSub || roleLabel}</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </button>
                {accountOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-12 z-40 w-52 overflow-hidden rounded-xl border border-border-soft bg-popover py-1 shadow-lg"
                  >
                    {topLinks.map((link) => (
                      <a
                        key={link.href}
                        role="menuitem"
                        href={link.href}
                        target="_blank"
                        rel="noopener"
                        className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent xl:hidden"
                      >
                        {link.label}
                      </a>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => signOut("/login?force=1")}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-destructive hover:bg-accent"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-64px-48px)]">{children}</main>
        <Toaster />

        <footer className="border-t border-border-soft">
          <div className="flex h-12 items-center justify-between px-4 text-xs text-muted-foreground sm:px-6">
            <span>© {new Date().getFullYear()} KTMONA · Trust Every Click</span>
            <span className="hidden sm:inline">{panelLabel}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
