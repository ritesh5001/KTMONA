"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  ShoppingBag,
  Undo2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/services/auth";

const LINKS = [
  { href: "/user/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/user/orders", label: "My Orders", icon: ShoppingBag },
  { href: "/user/returns", label: "Returns", icon: Undo2 },
  { href: "/user/wishlist", label: "Wishlist", icon: Heart },
  { href: "/user/addresses", label: "Addresses", icon: MapPin },
  { href: "/user/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/user/notifications", label: "Notifications", icon: Bell },
  { href: "/user/profile", label: "Profile", icon: UserRound },
];

/** Customer panel navigation: vertical card on desktop, scrollable pills on mobile. */
export function AccountNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="My account"
        className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
      >
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              isActive(href)
                ? "border-ink bg-ink text-paper dark:border-brand dark:bg-brand dark:text-ink"
                : "border-border-soft bg-card text-foreground hover:bg-mist"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </nav>

      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-28 overflow-hidden rounded-2xl bg-ink text-sidebar-foreground shadow-[0_8px_24px_rgba(12,27,66,0.12)]">
          <div className="border-b border-sidebar-border px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">My Account</p>
            <p className="mt-1 text-sm text-sidebar-foreground">Orders, returns and saved items</p>
          </div>
          <nav aria-label="My account" className="space-y-1 p-3">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand text-ink"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  {label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => signOut("/login?force=1")}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
              Log out
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
}
