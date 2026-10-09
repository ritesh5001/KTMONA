"use client";

import { ADS_ENABLED } from "@/lib/features";
import { AdsTurnedOff } from "@/components/seller/AdsTurnedOff";
import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Eye, IndianRupee, Megaphone, MousePointerClick, Pause, Play, ShoppingBag } from "lucide-react";
import { adminCenter } from "@/services/admin-center";
import { inr, inr2 } from "@/services/seller-center";
import { Btn, Empty, ErrorNote, Loading, PageHeader, PageShell, StatCard, StatusBadge, errorMessage } from "@/components/seller/kit";

function AdminAdsPage() {
  const [days, setDays] = React.useState(30);
  const { data, error, isLoading, mutate } = useSWR(["admin-ads", days], () => adminCenter.ads(days), { keepPreviousData: true });
  const [busy, setBusy] = React.useState<string | null>(null);
  const set = async (id: string, status: "ACTIVE" | "PAUSED") => {
    setBusy(id);
    try {
      await adminCenter.setAdStatus(id, status);
      toast.success(status === "PAUSED" ? "Campaign paused" : "Campaign resumed");
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const t = data?.totals;
  return (
    <PageShell>
      <PageHeader
        title="Ads"
        description="Every seller's sponsored-product campaigns. Ad spend is KTMONA revenue and is deducted from seller payouts. Pause campaigns that break advertising rules."
        actions={
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 rounded-lg border border-border-soft bg-card px-3 text-sm" aria-label="Period">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} tone="green" label="Ad revenue" value={t ? inr2.format(t.spend) : "—"} sub={t ? `${t.activeCampaigns} active campaign(s)` : undefined} />
        <StatCard icon={Eye} tone="blue" label="Impressions" value={t ? t.impressions.toLocaleString("en-IN") : "—"} />
        <StatCard icon={MousePointerClick} tone="orange" label="Clicks" value={t ? t.clicks.toLocaleString("en-IN") : "—"} sub={t && t.impressions ? `CTR ${((t.clicks / t.impressions) * 100).toFixed(1)}%` : undefined} />
        <StatCard icon={ShoppingBag} tone="navy" label="Ad-driven orders" value={t?.orders ?? "—"} sub={t ? `${inr.format(t.revenue)} sales` : undefined} />
      </section>
      <div className="rounded-2xl border border-border-soft bg-card">
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : !data || data.campaigns.length === 0 ? (
          <Empty icon={Megaphone} title="No ad campaigns yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead><tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground"><th className="px-4 py-3 font-semibold">Campaign</th><th className="px-3 py-3 font-semibold">Seller</th><th className="px-3 py-3 font-semibold">Budget / bid</th><th className="px-3 py-3 font-semibold">Views</th><th className="px-3 py-3 font-semibold">Clicks</th><th className="px-3 py-3 font-semibold">Spend</th><th className="px-3 py-3 font-semibold">Orders</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold" /></tr></thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-3 font-semibold">{c.name}<p className="text-xs font-normal text-muted-foreground">{c.products} product(s)</p></td>
                    <td className="px-3 py-3"><Link href={`/admin/sellers/${c.sellerId}`} className="hover:text-brand-strong">{c.storeName ?? "Seller"}</Link></td>
                    <td className="px-3 py-3 tabular-nums">{inr.format(c.dailyBudget)}/day · {inr2.format(c.bidPerClick)}</td>
                    <td className="px-3 py-3 tabular-nums">{c.impressions}</td>
                    <td className="px-3 py-3 tabular-nums">{c.clicks}</td>
                    <td className="px-3 py-3 tabular-nums">{inr2.format(c.spend)}</td>
                    <td className="px-3 py-3 tabular-nums">{c.orders}</td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "ACTIVE" ? <Btn size="sm" variant="outline" loading={busy === c.id} onClick={() => set(c.id, "PAUSED")}><Pause className="h-4 w-4" /> Pause</Btn> : c.status === "PAUSED" ? <Btn size="sm" variant="outline" loading={busy === c.id} onClick={() => set(c.id, "ACTIVE")}><Play className="h-4 w-4" /> Resume</Btn> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export default function AdminAdsPageGate() {
  if (!ADS_ENABLED) return <AdsTurnedOff backHref="/admin/dashboard" backLabel="Back to dashboard" />;
  return <AdminAdsPage />;
}
