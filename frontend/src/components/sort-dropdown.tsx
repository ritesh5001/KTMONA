"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { startNavigationFeedback } from "@/lib/navigation-feedback";

const SORT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest First" },
  { value: "popularity", label: "Most Popular" },
] as const;

export function SortDropdown() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "";

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      const value = e.target.value;
      if (value) {
        params.set("sort", value);
      } else {
        params.delete("sort");
      }
      params.delete("page"); // reset page on sort change
      startNavigationFeedback();
      router.push(`/marketplace?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <select
      value={current}
      onChange={handleChange}
      aria-label="Sort products"
      className="h-10 border border-border-soft bg-card px-3 py-2 text-xs uppercase tracking-wider text-foreground focus:border-brand/50 focus:outline-none transition-colors cursor-pointer"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
