"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Info, PackageCheck, RotateCcw } from "lucide-react";
import { inr } from "@/services/seller-center";
import { supplier, type RtoGroup } from "@/services/seller-supplier";
import { Badge, Btn, Empty, ErrorNote, Loading, PageHeader, PageShell, SearchBox, Tabs, errorMessage } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

type Tab = "add" | "applied";
type Draft = { prepaid: string; wdrp: string };

function Pair({ left, right }: { left: number; right: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-semibold tabular-nums text-red-700 dark:text-red-300">{left}%</span>
      <span className="text-muted-foreground">vs</span>
      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{right}%</span>
    </span>
  );
}

function Progress({ value, total }: { value: number; total: number }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">
        {value} / {total}
      </p>
      <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-mist">
        <div className="h-full rounded-full bg-brand" style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default function ReduceRtoPage() {
  const { data, error, isLoading, mutate } = useSWR("seller-pricing-rto", () => supplier.rtoGroups());
  const [tab, setTab] = React.useState<Tab>("add");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [saving, setSaving] = React.useState(false);

  const r = data?.rates;
  const groups = (data?.groups ?? []).filter((g) => (tab === "applied" ? g.applied : true)).filter((g) => g.label.toLowerCase().includes(search.trim().toLowerCase()));
  const appliedCount = data?.groups.filter((g) => g.applied).length ?? 0;

  const draftFor = (g: RtoGroup): Draft => drafts[g.key] ?? { prepaid: g.prepaidDiscount ? String(g.prepaidDiscount) : "", wdrp: g.wdrpDiscount ? String(g.wdrpDiscount) : "" };
  const setDraft = (key: string, patch: Partial<Draft>, g: RtoGroup) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...draftFor(g), ...patch } }));
    setSelected((prev) => new Set(prev).add(key));
  };
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const apply = async () => {
    const rows = (data?.groups ?? []).filter((g) => selected.has(g.key));
    if (rows.length === 0) return;
    setSaving(true);
    try {
      let updated = 0;
      let skipped = 0;
      for (const g of rows) {
        const d = draftFor(g);
        const res = await supplier.applyRto({
          groups: [g.key],
          prepaidDiscount: d.prepaid.trim() === "" ? 0 : Number(d.prepaid),
          wdrpDiscount: d.wdrp.trim() === "" ? 0 : Number(d.wdrp),
        });
        updated += res.updated;
        skipped += res.skipped;
      }
      toast.success(`Discount applied to ${updated} variant(s)`);
      if (skipped) toast.message(`${skipped} variant(s) skipped: a discount can't exceed half the price.`);
      setSelected(new Set());
      setDrafts({});
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell className="pb-28">
      <PageHeader
        title="Reduce RTO & Returns"
        breadcrumb={{ label: "Pricing", href: "/seller/pricing" }}
        actions={<SearchBox value={search} onChange={setSearch} placeholder="Search by subcategory" />}
      />

      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border-soft bg-card p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <PackageCheck className="h-5 w-5 text-brand" /> Reduce RTO by Prepaid Discount
              </h2>
              <div className="mt-4 flex flex-wrap items-end gap-6">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">COD RTO vs Prepaid RTO</p>
                  <Pair left={r?.codRto ?? 0} right={r?.prepaidRto ?? 0} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Products with Prepaid Discount</p>
                  <Progress value={r?.productsWithPrepaid ?? 0} total={r?.products ?? 0} />
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">✓ Convert COD to prepaid, get more prepaid orders &amp; reduce RTO risk</p>
            </section>
            <section className="rounded-2xl border border-border-soft bg-card p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <RotateCcw className="h-5 w-5 text-brand" /> Reduce Returns by Wrong/Defective Return Price
              </h2>
              <div className="mt-4 flex flex-wrap items-end gap-6">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">All Returns vs With WDRP</p>
                  <Pair left={r?.allReturns ?? 0} right={r?.wdrpReturns ?? 0} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Products with WDRP</p>
                  <Progress value={r?.productsWithWdrp ?? 0} total={r?.products ?? 0} />
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">✓ Add WDRP to avoid unwanted returns. Only get genuine ones</p>
            </section>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-3 text-sm">
            <Info className="h-4 w-4 text-blue-600" /> Sellers who apply both discounts see fewer RTOs and returns.
          </div>

          <div className="rounded-2xl border border-border-soft bg-card">
            <div className="px-4 pt-2">
              <Tabs
                tabs={[
                  { key: "add", label: "Add Discount" },
                  { key: "applied", label: "Discounts Applied" },
                ]}
                value={tab}
                onChange={setTab}
                counts={{ add: data?.groups.length ?? 0, applied: appliedCount }}
              />
            </div>
            {groups.length === 0 ? (
              <Empty title={tab === "applied" ? "No discounts applied yet" : "No products"} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-semibold" rowSpan={2}>Apply Discount on</th>
                      <th className="border-l border-border-soft px-3 py-2 text-center font-semibold" colSpan={2}>Reduce RTO by Prepaid</th>
                      <th className="border-l border-border-soft px-3 py-2 text-center font-semibold" colSpan={2}>Reduce Returns by Wrong/Defective Return Price</th>
                    </tr>
                    <tr className="border-b border-border-soft bg-mist/40 text-xs text-muted-foreground">
                      <th className="border-l border-border-soft px-3 py-2 font-medium">COD RTO vs Prepaid RTO</th>
                      <th className="px-3 py-2 font-medium">Prepaid Discount</th>
                      <th className="border-l border-border-soft px-3 py-2 font-medium">All Returns vs WDRP Returns</th>
                      <th className="px-3 py-2 font-medium">WDRP Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => {
                      const d = draftFor(g);
                      return (
                        <tr key={g.key} className={cn("border-b border-border-soft last:border-0", selected.has(g.key) && "bg-brand/5")}>
                          <td className="px-4 py-3">
                            <label className="flex cursor-pointer items-start gap-3">
                              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-brand)]" checked={selected.has(g.key)} onChange={() => toggle(g.key)} />
                              <span>
                                <span className="block font-semibold">{g.label}</span>
                                <span className="block text-xs text-muted-foreground">
                                  Price: {inr.format(g.priceMin)} – {inr.format(g.priceMax)} · {g.products} products
                                </span>
                                {g.key === "all" ? <Badge tone="green" className="mt-1">Recommended for best results</Badge> : null}
                              </span>
                            </label>
                          </td>
                          <td className="border-l border-border-soft px-3 py-3"><Pair left={r?.codRto ?? 0} right={r?.prepaidRto ?? 0} /></td>
                          <td className="px-3 py-3">
                            <div className="relative w-32">
                              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                              <input type="number" min={0} inputMode="decimal" value={d.prepaid} onChange={(e) => setDraft(g.key, { prepaid: e.target.value }, g)} placeholder="Discount" aria-label={`Prepaid discount for ${g.label}`} className="h-9 w-full rounded-lg border border-border-soft bg-card pl-6 pr-2 text-sm" />
                            </div>
                          </td>
                          <td className="border-l border-border-soft px-3 py-3"><Pair left={r?.allReturns ?? 0} right={r?.wdrpReturns ?? 0} /></td>
                          <td className="px-3 py-3">
                            <div className="relative w-32">
                              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                              <input type="number" min={0} inputMode="decimal" value={d.wdrp} onChange={(e) => setDraft(g.key, { wdrp: e.target.value }, g)} placeholder="Discount" aria-label={`WDRP discount for ${g.label}`} className="h-9 w-full rounded-lg border border-border-soft bg-card pl-6 pr-2 text-sm" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Prepaid discount is a flat ₹ off for customers who pay online. WDRP discount lowers the price for customers who accept that only
            wrong or defective items can be returned. Enter 0 to remove a discount.
          </p>
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-soft bg-card/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-sm">
            <span className="text-muted-foreground">Selected:</span> <b className="tabular-nums">{selected.size}</b>
          </p>
          <Btn variant="primary" disabled={selected.size === 0} loading={saving} onClick={apply}>
            Apply Discount
          </Btn>
        </div>
      </div>
    </PageShell>
  );
}
