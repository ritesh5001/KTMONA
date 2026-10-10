"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { MapPin, Search, Store } from "lucide-react";
import { storesApi } from "@/services/platform";

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Every active KTMONA shop with live products. */
export default function VendorsPage() {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search.trim());
  const { data, isLoading } = useSWR(["stores", q], () => storesApi.list({ search: q }));
  const stores = data?.stores ?? [];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 xl:px-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">Shops on KTMONA</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every shop is a verified seller approved by the KTMONA team.</p>
      <label className="relative mt-5 block max-w-md">
        <span className="sr-only">Search shops</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shops by name"
          className="h-10 w-full rounded-md border border-border-soft bg-background pl-10 pr-3 text-sm focus-visible:border-brand focus-visible:outline-none"
        />
      </label>

      {isLoading && !data ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-mist" />)}
        </div>
      ) : stores.length === 0 ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          <Store className="mx-auto h-8 w-8" />
          <p className="mt-2">No shops found.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stores.map((s) => (
            <Link key={s.slug} href={`/vendors/${s.slug}`} className="flex items-center gap-3 rounded-2xl border border-border-soft bg-card p-4 transition-shadow hover:shadow-md">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-mist">
                {s.logo ? <Image src={s.logo} alt={s.name} width={56} height={56} className="h-full w-full object-cover" /> : <span className="text-xl font-bold text-brand-strong">{s.name.charAt(0)}</span>}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block text-xs text-muted-foreground">{s.productCount} products</span>
                {s.city ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" aria-hidden />{s.city}</span> : null}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
