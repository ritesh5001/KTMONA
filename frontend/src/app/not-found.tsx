"use client";

import * as React from "react";
import Link from "next/link";

const PORTAL_SUBDOMAINS = ["seller.", "admin."];

/**
 * Main-domain URL for a page that 404'd on a portal subdomain, or null.
 *
 * The proxy rewrites seller./admin. paths into the portal (seller.ktmona.com/x
 * → /seller/x), so a main-site page it does not know about would 404 there.
 * Those are sent to the same path on the main domain. Paths that are already
 * portal paths (/seller/…, /admin/…) are real portal 404s and stay here.
 */
function mainDomainTarget(): string | null {
  const { hostname, port, protocol, pathname, search } = window.location;
  const sub = PORTAL_SUBDOMAINS.find((s) => hostname.startsWith(s));
  if (!sub) return null;
  if (pathname.startsWith("/seller") || pathname.startsWith("/admin")) return null;
  const main = hostname.slice(sub.length);
  return `${protocol}//${main}${port ? `:${port}` : ""}${pathname}${search}`;
}

export default function NotFound() {
  const [redirecting, setRedirecting] = React.useState(true);

  React.useEffect(() => {
    const target = mainDomainTarget();
    if (target) window.location.replace(target);
    else setRedirecting(false);
  }, []);

  if (redirecting) {
    return <div className="min-h-[60vh]" aria-busy="true" />;
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-strong">404</p>
      <h1 className="font-serif text-3xl font-light text-foreground sm:text-4xl">This page could not be found</h1>
      <p className="max-w-md text-muted-foreground">The link may be broken, or the page may have moved.</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-navy px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink"
      >
        Go to KTMONA home
      </Link>
    </div>
  );
}
