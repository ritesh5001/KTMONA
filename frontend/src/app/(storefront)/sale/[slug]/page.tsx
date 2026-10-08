import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketplaceProductCard, type MarketplaceCardProduct } from "@/components/marketplace-product-card";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface SaleResponse {
  campaign: {
    name: string;
    slug: string;
    description: string | null;
    bannerImage: string | null;
    startsAt: string;
    endsAt: string;
    minDiscountPercent: number;
    phase: "UPCOMING" | "LIVE" | "ENDED" | "DRAFT" | "CANCELLED";
  };
  products: MarketplaceCardProduct[];
}

async function loadSale(slug: string): Promise<SaleResponse | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/v1/campaigns/${encodeURIComponent(slug)}`, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await loadSale((await params).slug);
  if (!data) return { title: "Sale" };
  return {
    title: `${data.campaign.name} | Up to ${data.campaign.minDiscountPercent}%+ off`,
    description: data.campaign.description ?? `Shop the ${data.campaign.name} on KTMONA.`,
  };
}

function fmt(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function SalePage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await loadSale((await params).slug);
  if (!data) notFound();
  const { campaign: c, products } = data;
  return (
    <div className="min-h-[60vh] bg-background">
      <section
        className="relative overflow-hidden bg-gradient-to-r from-ink to-navy px-6 py-12 text-white sm:py-16"
        style={c.bannerImage ? { backgroundImage: `linear-gradient(to right, rgba(12,27,66,.92), rgba(12,27,66,.4)), url(${c.bannerImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <div className="mx-auto max-w-6xl">
          <span className="inline-block rounded-lg bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">
            {c.phase === "LIVE" ? "Live now" : c.phase === "UPCOMING" ? "Coming soon" : "Ended"}
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{c.name}</h1>
          <p className="mt-2 text-lg text-white/85">{c.minDiscountPercent}% off and more from verified sellers</p>
          {c.description ? <p className="mt-2 max-w-2xl text-sm text-white/75">{c.description}</p> : null}
          <p className="mt-4 text-sm text-white/70">{fmt(c.startsAt)} – {fmt(c.endsAt)}</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {c.phase !== "LIVE" ? (
          <p className="rounded-2xl border border-border-soft bg-card p-10 text-center text-muted-foreground">
            {c.phase === "UPCOMING" ? `The sale starts on ${fmt(c.startsAt)}. Come back then!` : "This sale has ended."}
          </p>
        ) : products.length === 0 ? (
          <p className="rounded-2xl border border-border-soft bg-card p-10 text-center text-muted-foreground">Sale products are on their way.</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <MarketplaceProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
