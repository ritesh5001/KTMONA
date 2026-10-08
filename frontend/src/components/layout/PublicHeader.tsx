"use client";

import * as React from "react";
import Link from "next/link";
import { CircleUserRound, Menu, Search, ShoppingCart, Store } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CategoryMegaMenu } from "@/components/layout/CategoryMegaMenu";
import { MobileCategoryDrawer } from "@/components/layout/MobileCategoryDrawer";
import { useAuth } from "@/hooks/use-auth";
import { getRoleDashboardUrl } from "@/lib/subdomain";
import { signOut } from "@/services/auth";

const SEARCH_PLACEHOLDER = "Try Saree, Kurti or search by product name";

function SearchForm({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  return (
    <form action="/search" method="get" role="search" className={className}>
      <label className="relative block">
        <span className="sr-only">Search products</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          name="q"
          placeholder={SEARCH_PLACEHOLDER}
          autoComplete="off"
          autoFocus={autoFocus}
          className="h-10 w-full rounded-md border border-border-soft bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </label>
    </form>
  );
}

export function PublicHeader() {
  const { user, loading, isSignedIn } = useAuth();
  const role = (user?.role ?? "USER").toUpperCase();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  const isShopper = isSignedIn && role === "USER";
  const accountHref = isSignedIn ? getRoleDashboardUrl(role) : "/login";
  const displayName: string | null = user?.fullName ?? user?.name ?? null;

  const accountLinks = isShopper
    ? [
        { href: "/user/orders", label: "My Orders" },
        { href: "/user/wishlist", label: "Wishlist" },
        { href: "/user/profile", label: "My Profile" },
        { href: "/support", label: "Help & Support" },
      ]
    : isSignedIn
      ? [{ href: accountHref, label: "Go to dashboard" }]
      : [];

  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-background">
      {/* Desktop / tablet */}
      <div className="mx-auto hidden h-[72px] max-w-[1440px] items-center gap-6 px-4 md:flex xl:px-8">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="-ml-1 rounded-md p-2 text-foreground hover:bg-mist lg:hidden"
          aria-label="Open categories"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" prefetch className="shrink-0">
          <BrandLogo className="h-8" priority />
        </Link>
        <SearchForm className="w-full max-w-[460px] flex-1" />

        <div className="ml-auto flex h-full items-center">
          <Link
            href="/register/seller"
            className="hidden h-10 items-center gap-2 border-r border-border-soft pr-5 text-sm text-foreground/85 hover:text-foreground lg:flex"
          >
            <Store className="h-4 w-4" aria-hidden /> Become a Seller
          </Link>

          {/* Profile with hover menu */}
          <div className="group relative flex h-full items-center px-5">
            <Link href={isShopper ? "/user/dashboard" : accountHref} className="flex flex-col items-center gap-0.5 text-foreground/85 hover:text-foreground">
              <CircleUserRound className="h-5 w-5" aria-hidden />
              <span className="text-xs font-medium">{isSignedIn ? (role === "USER" ? "Profile" : "Dashboard") : "Profile"}</span>
            </Link>
            <div className="pointer-events-none absolute right-0 top-full z-40 w-64 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              <div className="rounded-b-xl border border-border-soft bg-background p-4 shadow-lg">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : isSignedIn ? (
                  <>
                    <p className="text-sm font-semibold">Hello{displayName ? `, ${displayName}` : ""}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email ?? user?.phone ?? ""}</p>
                    <div className="mt-3 border-t border-border-soft pt-2">
                      {accountLinks.map((l) => (
                        <Link key={l.href} href={l.href} className="block py-1.5 text-sm hover:text-brand-strong">{l.label}</Link>
                      ))}
                      <button type="button" onClick={() => signOut("/login?force=1")} className="block w-full py-1.5 text-left text-sm hover:text-brand-strong">
                        Logout
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Hello User</p>
                    <p className="text-xs text-muted-foreground">To access your KTMONA account</p>
                    <Link href="/login" className="mt-3 flex h-10 items-center justify-center rounded-md bg-ink text-sm font-semibold text-paper hover:bg-navy">
                      Sign Up / Log In
                    </Link>
                    <div className="mt-3 border-t border-border-soft pt-2">
                      <Link href="/login?returnTo=%2Fuser%2Forders" className="block py-1.5 text-sm hover:text-brand-strong">My Orders</Link>
                      <Link href="/support" className="block py-1.5 text-sm hover:text-brand-strong">Help & Support</Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <Link href="/cart" prefetch className="flex flex-col items-center gap-0.5 pl-1 text-foreground/85 hover:text-foreground">
            <ShoppingCart className="h-5 w-5" aria-hidden />
            <span className="text-xs font-medium">Cart</span>
          </Link>
        </div>
      </div>

      {/* Phone */}
      <div className="md:hidden">
        <div className="flex h-14 items-center gap-2 px-3">
          <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-md p-2 hover:bg-mist" aria-label="Open categories">
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" prefetch className="flex-1">
            <BrandLogo className="h-7" priority />
          </Link>
          <Link href={isSignedIn ? (isShopper ? "/user/dashboard" : accountHref) : "/login"} className="rounded-md p-2 hover:bg-mist" aria-label="Account">
            <CircleUserRound className="h-5 w-5" />
          </Link>
          <Link href="/cart" prefetch className="rounded-md p-2 hover:bg-mist" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
          </Link>
        </div>
        <div className="px-3 pb-3">
          <SearchForm />
        </div>
      </div>

      <CategoryMegaMenu />

      <MobileCategoryDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        accountLinks={
          isSignedIn
            ? [...accountLinks, { href: "#", label: "Logout", onClick: () => signOut("/login?force=1") }]
            : [
                { href: "/login", label: "Sign Up / Log In" },
                { href: "/register/seller", label: "Become a Seller" },
                { href: "/support", label: "Help & Support" },
              ]
        }
      />
    </header>
  );
}
