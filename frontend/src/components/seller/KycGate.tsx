"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { ShieldAlert } from "lucide-react";
import { sellerCenter } from "@/services/seller-center";

/**
 * Sellers cannot list products until KTMONA verifies their KYC (the API
 * refuses too). `block` replaces an add-product form with the reason;
 * `banner` shows the reason above a page that stays usable (e.g. history).
 */
export function KycGate({ children, mode = "block" }: { children?: React.ReactNode; mode?: "block" | "banner" }) {
  const { data, error, isLoading, mutate } = useSWR("seller-settings", sellerCenter.settings);
  // A failed settings load must not leave the form behind a skeleton forever.
  if (error && !data && mode === "block") {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-red-800">We couldn&apos;t check your KYC status right now. Please try again.</p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-navy px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink"
        >
          Retry
        </button>
      </div>
    );
  }
  if (isLoading || !data) return mode === "block" ? <div className="h-40 animate-pulse rounded-2xl bg-mist" /> : <>{children}</>;

  const status = data.business?.kycStatus ?? null;
  // Verified, or an admin lets this seller list before KYC is verified.
  if (status === "VERIFIED" || data.business?.kycRequired === false) return <>{children}</>;

  const copy =
    status === "PENDING"
      ? { title: "Your KYC is under review", body: "You can add products as soon as KTMONA verifies your KYC. This usually takes 1–2 business days.", cta: "View KYC details" }
      : status === "REJECTED"
        ? { title: "Your KYC was not approved", body: "Please correct your business & KYC details in Settings and resubmit. You can add products once it is verified.", cta: "Fix KYC details" }
        : { title: "Complete your KYC to start selling", body: "Add your business, GST/PAN and bank details in Settings. You can list products once KTMONA has verified your KYC.", cta: "Complete KYC" };

  const notice = (
    <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-amber-300/70 bg-amber-50 p-5 sm:flex-row sm:items-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground">{copy.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
      </div>
      <Link
        href="/seller/settings"
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-navy px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink"
      >
        {copy.cta}
      </Link>
    </div>
  );

  return mode === "banner" ? (
    <div className="space-y-4">
      {notice}
      {children}
    </div>
  ) : (
    notice
  );
}
