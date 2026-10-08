"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Eye, IndianRupee, Megaphone, MousePointerClick, Pause, Play, Plus, ShoppingBag, Square } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sellerCenter, inr, inr2, fmtDate, type AdCampaign } from "@/services/seller-center";
import {
  Btn,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  PageShell,
  Panel,
  StatCard,
  StatusBadge,
  errorMessage,
  inputCls,
} from "@/components/seller/kit";
import { ProductPicker } from "@/components/seller/ProductPicker";

export default function AdsPage() {
  const [days, setDays] = React.useState(30);
  const { data, error, isLoading, mutate } = useSWR(["seller-ads", days], () => sellerCenter.ads(days), { keepPreviousData: true });
  const [editing, setEditing] = React.useState<AdCampaign | "new" | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const setStatus = async (c: AdCampaign, status: "ACTIVE" | "PAUSED" | "ENDED") => {
    setBusy(c.id);
    try {
      await sellerCenter.updateCampaign(c.id, { status });
      toast.success(status === "ACTIVE" ? "Campaign resumed" : status === "PAUSED" ? "Campaign paused" : "Campaign ended");
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
        title="KTMONA Ads"
        description="Show your products as Sponsored in the marketplace and search. You pay only when a shopper clicks, up to your daily budget. Spend is deducted from your payouts."
        actions={
          <>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 rounded-lg border border-border-soft bg-card px-3 text-sm" aria-label="Period">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Btn variant="brand" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> New campaign
            </Btn>
          </>
        }
      />
      {error && !data ? <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Eye} tone="blue" label="Impressions" value={t ? t.impressions.toLocaleString("en-IN") : "—"} />
        <StatCard icon={MousePointerClick} tone="orange" label="Clicks" value={t ? t.clicks.toLocaleString("en-IN") : "—"} sub={t ? `CTR ${t.ctr}%` : undefined} />
        <StatCard icon={IndianRupee} tone="red" label="Spend" value={t ? inr2.format(t.spend) : "—"} />
        <StatCard icon={ShoppingBag} tone="green" label="Ad orders" value={t ? t.orders : "—"} sub={t ? `${inr.format(t.revenue)} sales · ROAS ${t.roas}x` : undefined} />
      </section>

      {data && data.daily.length > 0 ? (
        <Panel title="Daily performance">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }} />
                <Area type="monotone" dataKey="clicks" stroke="var(--color-brand)" fill="var(--color-brand)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="orders" stroke="#16a34a" fill="#16a34a" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      ) : null}

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="border-b border-border-soft px-5 py-4">
          <h2 className="text-base font-semibold">Campaigns</h2>
        </div>
        {isLoading && !data ? (
          <Loading />
        ) : !data || data.campaigns.length === 0 ? (
          <Empty
            icon={Megaphone}
            title="No campaigns yet"
            text="Advertise your bestsellers to reach more shoppers. Start with a small daily budget."
            action={<Btn variant="brand" onClick={() => setEditing("new")}>Create your first campaign</Btn>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Campaign</th>
                  <th className="px-3 py-3 font-semibold">Budget / day</th>
                  <th className="px-3 py-3 font-semibold">Bid / click</th>
                  <th className="px-3 py-3 font-semibold">Spent today</th>
                  <th className="px-3 py-3 font-semibold">Views</th>
                  <th className="px-3 py-3 font-semibold">Clicks</th>
                  <th className="px-3 py-3 font-semibold">Spend</th>
                  <th className="px-3 py-3 font-semibold">Orders</th>
                  <th className="px-3 py-3 font-semibold">ROAS</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <StatusBadge status={c.status} />
                        {c.productCount} product(s) · from {fmtDate(c.startsAt)}{c.endsAt ? ` to ${fmtDate(c.endsAt)}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{inr.format(c.dailyBudget)}</td>
                    <td className="px-3 py-3 tabular-nums">{inr2.format(c.bidPerClick)}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {inr2.format(c.spentToday)}
                      <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-mist">
                        <div className="h-full bg-brand" style={{ width: `${Math.min(100, (c.spentToday / c.dailyBudget) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{c.impressions}</td>
                    <td className="px-3 py-3 tabular-nums">{c.clicks} <span className="text-xs text-muted-foreground">({c.ctr}%)</span></td>
                    <td className="px-3 py-3 tabular-nums">{inr2.format(c.spend)}</td>
                    <td className="px-3 py-3 tabular-nums">{c.orders}</td>
                    <td className="px-3 py-3 tabular-nums">{c.roas}x</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {c.status !== "ENDED" ? (
                          <>
                            <Btn size="sm" variant="outline" onClick={() => setEditing(c)}>Edit</Btn>
                            {c.status === "ACTIVE" ? (
                              <Btn size="sm" variant="ghost" loading={busy === c.id} onClick={() => setStatus(c, "PAUSED")} aria-label="Pause"><Pause className="h-4 w-4" /></Btn>
                            ) : (
                              <Btn size="sm" variant="ghost" loading={busy === c.id} onClick={() => setStatus(c, "ACTIVE")} aria-label="Resume"><Play className="h-4 w-4" /></Btn>
                            )}
                            <Btn size="sm" variant="ghost" loading={busy === c.id} onClick={() => setStatus(c, "ENDED")} aria-label="End"><Square className="h-4 w-4" /></Btn>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CampaignModal
        campaign={editing}
        minBid={data?.minBid ?? 1}
        minBudget={data?.minDailyBudget ?? 50}
        onClose={() => setEditing(null)}
        onSaved={() => mutate()}
      />
    </PageShell>
  );
}

function CampaignModal({ campaign, minBid, minBudget, onClose, onSaved }: { campaign: AdCampaign | "new" | null; minBid: number; minBudget: number; onClose: () => void; onSaved: () => void }) {
  const isNew = campaign === "new";
  const existing = campaign && campaign !== "new" ? campaign : null;
  const [name, setName] = React.useState("");
  const [budget, setBudget] = React.useState("200");
  const [bid, setBid] = React.useState("3");
  const [endsAt, setEndsAt] = React.useState("");
  const [productIds, setProductIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!campaign) return;
    setName(existing?.name ?? "Bestsellers boost");
    setBudget(String(existing?.dailyBudget ?? 200));
    setBid(String(existing?.bidPerClick ?? 3));
    setEndsAt(existing?.endsAt ? existing.endsAt.slice(0, 10) : "");
    setProductIds(existing?.productIds ?? []);
  }, [campaign]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!campaign) return null;
  const clicksPerDay = Number(bid) > 0 ? Math.floor(Number(budget) / Number(bid)) : 0;
  const submit = async () => {
    setSaving(true);
    try {
      const body = {
        name,
        dailyBudget: Number(budget),
        bidPerClick: Number(bid),
        endsAt: endsAt ? new Date(`${endsAt}T23:59:59`).toISOString() : null,
        productIds,
      };
      if (isNew) await sellerCenter.createCampaign(body);
      else await sellerCenter.updateCampaign(existing!.id, body);
      toast.success(isNew ? "Campaign is live" : "Campaign updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isNew ? "New ad campaign" : `Edit ${existing?.name}`}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="brand" loading={saving} disabled={productIds.length === 0 || name.trim().length < 3} onClick={submit}>
            {isNew ? "Launch campaign" : "Save"}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Campaign name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Daily budget (₹)" hint={`Minimum ₹${minBudget}. Ads stop for the day once this is spent.`}>
            <input type="number" min={minBudget} className={inputCls} value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>
          <Field label="Cost per click (₹)" hint={`Minimum ₹${minBid}. Higher bids show your products first.`}>
            <input type="number" min={minBid} step="0.5" className={inputCls} value={bid} onChange={(e) => setBid(e.target.value)} />
          </Field>
          <Field label="End date (optional)">
            <input type="date" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
          <div className="rounded-xl bg-mist p-3 text-sm">
            Up to <b>{clicksPerDay}</b> clicks a day · max spend <b>{inr.format(Number(budget) || 0)}</b>/day
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Products to advertise</p>
          <ProductPicker selected={productIds} onChange={setProductIds} />
        </div>
      </div>
    </Modal>
  );
}
