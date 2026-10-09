"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BadgeCheck, Bell, Smartphone, Truck, X } from "lucide-react";
import { getSubdomain } from "@/lib/subdomain";
import { AppStoreButtons } from "@/components/site/SiteLinks";

/** Fired by any "Download App" button to open the promo on demand. */
export const OPEN_APP_PROMO_EVENT = "ktmona-open-app-promo";

export function openAppPromo() {
  window.dispatchEvent(new Event(OPEN_APP_PROMO_EVENT));
}

/** Once dismissed, the promo stays closed for the rest of this visit (tab session). */
const DISMISSED_KEY = "ktmona-app-promo-dismissed";

/** Customer-panel pages where the promo must not interrupt a task. */
const QUIET_PATHS = ["/login", "/register", "/verify-otp", "/forgot-password", "/reset-password", "/checkout"];

const PERKS = [
  { icon: Truck, text: "Track every order live" },
  { icon: Bell, text: "Early access to sales and offers" },
  { icon: BadgeCheck, text: "Shop verified sellers on the go" },
];

/**
 * KTMONA app advertisement shown as soon as a customer opens the customer
 * panel (storefront). It has a close button, appears once per visit, and can
 * be reopened from any "Download App" button.
 */
export function AppDownloadPromo() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (getSubdomain() !== "main") return;
    if (QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Storage blocked (private mode): show it once per page load instead.
    }
    if (!dismissed) setOpen(true);
    // Only on first arrival, not on every client-side navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_APP_PROMO_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_APP_PROMO_EVENT, onOpen);
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-promo-title"
        className="relative w-full max-w-3xl overflow-hidden rounded-t-3xl bg-ink text-paper shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-paper transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid sm:grid-cols-[1.25fr_1fr]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Image src="/ktmona-icon.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
              <div>
                <p className="text-sm font-semibold">KTMONA App</p>
                <p className="text-xs text-paper/70">Trust Every Click</p>
              </div>
            </div>
            <h2 id="app-promo-title" className="mt-5 font-serif text-3xl font-light leading-tight sm:text-4xl">
              Shopping is better on the <span className="text-brand">KTMONA app</span>
            </h2>
            <ul className="mt-5 space-y-2.5">
              {PERKS.map((perk) => (
                <li key={perk.text} className="flex items-center gap-3 text-sm text-paper/90">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <perk.icon className="h-4 w-4" />
                  </span>
                  {perk.text}
                </li>
              ))}
            </ul>
            <AppStoreButtons className="mt-6" />
            <button type="button" onClick={close} className="mt-4 text-sm text-paper/70 underline-offset-4 hover:text-paper hover:underline">
              Continue on website
            </button>
          </div>

          <div className="relative hidden items-center justify-center bg-gradient-to-br from-brand to-[#ffb24d] sm:flex">
            <div className="relative flex h-72 w-40 flex-col items-center justify-center gap-3 rounded-[2rem] border-[6px] border-ink bg-paper text-ink shadow-xl">
              <Image src="/ktmona-icon.png" alt="" width={64} height={64} className="h-16 w-16 rounded-2xl" />
              <p className="text-sm font-bold tracking-wide">KTMONA</p>
              <Smartphone className="h-5 w-5 text-brand-strong" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
