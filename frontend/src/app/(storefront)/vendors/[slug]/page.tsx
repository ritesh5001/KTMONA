"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { MapPin, Package, Star, Store } from "lucide-react";
import { storesApi } from "@/services/platform";
import { ProductFeed } from "@/components/storefront/ProductFeed";

/** A seller's shop: real profile, rating from shopper reviews, live products. */
export default function VendorProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, isLoading } = useSWR(slug ? ["store", slug] : null, () => storesApi.get(slug));
  const store = data?.store;

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <Store className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Shop not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This shop may have closed or the link is wrong.</p>
        <Link href="/vendors" className="mt-6 inline-block text-sm font-medium text-brand-strong hover:underline">Browse all shops</Link>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <section className="border-b border-border-soft bg-card">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center xl:px-8">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-mist">
            {store?.logo ? (
              <Image src={store.logo} alt={store.name} width={80} height={80} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-brand-strong">{store?.name?.charAt(0) ?? ""}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {isLoading || !store ? (
              <div className="h-14 w-64 animate-pulse rounded-lg bg-mist" />
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong">Verified KTMONA Seller</p>
                <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{store.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  {store.rating.count > 0 && store.rating.average != null ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                        {store.rating.average.toFixed(1)} <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
                      </span>
                      {store.rating.count.toLocaleString("en-IN")} {store.rating.count === 1 ? "rating" : "ratings"}
                    </span>
                  ) : (
                    <span>New shop</span>
                  )}
                  <span className="inline-flex items-center gap-1"><Package className="h-4 w-4" aria-hidden />{store.productCount} products</span>
                  {store.city ? <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden />{store.city}{store.state ? `, ${store.state}` : ""}</span> : null}
                </div>
                {store.description ? <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{store.description}</p> : null}
                {store.onHoliday ? <p className="mt-3 text-sm font-medium text-orange-600">This shop is on a short holiday. Products will be back soon.</p> : null}
              </>
            )}
          </div>
        </div>
      </section>
      {store ? <ProductFeed title="Products from this shop" sellerId={store.sellerId} /> : null}
    </div>
  );
}
