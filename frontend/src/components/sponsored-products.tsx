"use client";

import { ADS_ENABLED } from "@/lib/features";
import * as React from "react";
import { MarketplaceProductCard, type MarketplaceCardProduct } from "@/components/marketplace-product-card";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";

type Sponsored = MarketplaceCardProduct & { adCampaignId: string; sponsored: true };

/**
 * "Sponsored" rail fed by KTMONA Ads. Renders nothing when no campaign is
 * eligible, so the page looks the same for stores without ads.
 */
export function SponsoredProducts({
  categoryId,
  search,
  limit = 4,
  excludeIds = [],
  title = "Sponsored",
}: {
  categoryId?: string;
  search?: string;
  limit?: number;
  excludeIds?: string[];
  title?: string;
}) {
  const [items, setItems] = React.useState<Sponsored[]>([]);
  const exclude = excludeIds.slice(0, 50).join(",");

  React.useEffect(() => {
    if (!API_BASE_URL || !ADS_ENABLED) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: String(limit) });
    if (categoryId) params.set("categoryId", categoryId);
    if (search) params.set("search", search);
    if (exclude) params.set("exclude", exclude);
    fetch(`${API_BASE_URL}/v1/ads/sponsored?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setItems(Array.isArray(json?.data) ? json.data : []))
      .catch(() => {});
    return () => controller.abort();
  }, [categoryId, search, limit, exclude]);

  if (items.length === 0) return null;

  const recordClick = (item: Sponsored) => {
    try {
      fetch(`${API_BASE_URL}/v1/ads/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: item.adCampaignId, productId: item.id }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  return (
    <section aria-label={title} className="py-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">{title}</h2>
        <span className="rounded-md bg-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ad</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.id} className="relative" onClickCapture={() => recordClick(item)}>
            <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-paper">
              Sponsored
            </span>
            <MarketplaceProductCard product={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
