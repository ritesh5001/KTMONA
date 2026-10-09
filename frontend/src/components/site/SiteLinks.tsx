"use client";

import * as React from "react";
import useSWR from "swr";
import { Apple, Facebook, Instagram, Youtube } from "lucide-react";
import { siteApi, type SiteLinks } from "@/services/platform";
import { cn } from "@/lib/utils";

/** Same defaults the API returns before an admin saves anything. */
const FALLBACK_LINKS: SiteLinks = {
  playStoreUrl: null,
  appStoreUrl: null,
  facebookUrl: "https://www.facebook.com/share/1F8jbWMxN8/",
  instagramUrl: "https://www.instagram.com/ktmona",
  youtubeUrl: null,
};

/** App download + social links, managed in Admin → App & Social Links. */
export function useSiteLinks(): SiteLinks {
  const { data } = useSWR("site-links", siteApi.links, {
    fallbackData: FALLBACK_LINKS,
    revalidateOnFocus: false,
    dedupingInterval: 10 * 60_000,
  });
  return data ?? FALLBACK_LINKS;
}

const SOCIALS = [
  {
    key: "facebookUrl" as const,
    label: "Facebook",
    icon: Facebook,
    className: "bg-[#1877F2]",
  },
  {
    key: "instagramUrl" as const,
    label: "Instagram",
    icon: Instagram,
    className: "bg-[radial-gradient(circle_at_30%_107%,#fdf497_0%,#fdf497_5%,#fd5949_45%,#d6249f_60%,#285AEB_90%)]",
  },
  {
    key: "youtubeUrl" as const,
    label: "YouTube",
    icon: Youtube,
    className: "bg-[#FF0000]",
  },
];

/** "Follow Us": official brand colours, only for accounts that exist. */
export function FollowUs({ className }: { className?: string }) {
  const links = useSiteLinks();
  const items = SOCIALS.filter((s) => links[s.key]);
  if (items.length === 0) return null;
  return (
    <div className={className}>
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em]">Follow Us</p>
      <div className="flex gap-3">
        {items.map((s) => (
          <a
            key={s.key}
            href={links[s.key]!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`KTMONA on ${s.label}`}
            title={s.label}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm transition-transform hover:-translate-y-0.5",
              s.className
            )}
          >
            <s.icon className="h-5 w-5" strokeWidth={2} />
          </a>
        ))}
      </div>
    </div>
  );
}

function GooglePlayMark({ className }: { className?: string }) {
  // Google Play's four-colour triangle.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#00D7FE" d="M3.6 1.8 13.4 12 3.6 22.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Z" />
      <path fill="#FFCE00" d="m16.8 8.6 3.5 2c1 .6 1 2.2 0 2.8l-3.5 2L13.4 12l3.4-3.4Z" />
      <path fill="#FF3A44" d="M16.8 15.4 13.4 12 3.6 22.2c.4.2.9.2 1.4-.1l11.8-6.7Z" />
      <path fill="#00F076" d="M16.8 8.6 5 1.9c-.5-.3-1-.3-1.4-.1L13.4 12l3.4-3.4Z" />
    </svg>
  );
}

/**
 * Google Play / App Store buttons. Until the app is published (no link saved
 * in admin) they read "Coming soon" and are not clickable.
 */
export function AppStoreButtons({ className, dark = true }: { className?: string; dark?: boolean }) {
  const links = useSiteLinks();
  const base = cn(
    "inline-flex h-12 min-w-[160px] items-center gap-2.5 rounded-xl px-4 text-left transition-transform",
    dark ? "bg-black text-white" : "border border-border-strong bg-card text-foreground"
  );
  const store = (href: string | null, top: string, name: string, mark: React.ReactNode) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn(base, "hover:-translate-y-0.5")}>
        {mark}
        <span className="leading-tight">
          <span className="block text-[10px] uppercase tracking-wide opacity-80">{top}</span>
          <span className="block text-base font-semibold">{name}</span>
        </span>
      </a>
    ) : (
      <span className={cn(base, "cursor-default opacity-90")} aria-disabled="true">
        {mark}
        <span className="leading-tight">
          <span className="block text-[10px] uppercase tracking-wide opacity-80">Coming soon on</span>
          <span className="block text-base font-semibold">{name}</span>
        </span>
      </span>
    );
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {store(links.playStoreUrl, "Get it on", "Google Play", <GooglePlayMark className="h-6 w-6" />)}
      {store(links.appStoreUrl, "Download on the", "App Store", <Apple className="h-6 w-6" />)}
    </div>
  );
}
