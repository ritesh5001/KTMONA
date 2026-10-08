"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, Boxes, CheckCircle2, Download, PackageX, Save, Upload } from "lucide-react";
import { sellerCenter } from "@/services/seller-center";
import {
  Btn,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  PageShell,
  Pager,
  SearchBox,
  StatCard,
  StatusBadge,
  Tabs,
  Thumb,
  errorMessage,
  useDebounced,
} from "@/components/seller/kit";
import { cn } from "@/lib/utils";

type Filter = "all" | "out_of_stock" | "low_stock" | "in_stock";
const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All variants" },
  { key: "out_of_stock", label: "Out of stock" },
  { key: "low_stock", label: "Low stock" },
  { key: "in_stock", label: "In stock" },
];

export default function InventoryPage() {
  const params = useSearchParams();
  const [filter, setFilter] = React.useState<Filter>((TABS.find((t) => t.key === params.get("filter"))?.key ?? "all") as Filter);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const { data, error, isLoading, mutate } = useSWR(["seller-inventory", filter, page, q], () => sellerCenter.inventory({ filter, page, search: q }), {
    keepPreviousData: true,
  });

  const dirty = Object.entries(edits).filter(([id, v]) => {
    const row = data?.variants.find((x) => x.variantId === id);
    return row && v.trim() !== "" && Number(v) !== row.stock;
  });

  const save = async () => {
    const updates = dirty.map(([variantId, v]) => ({ variantId, stock: Math.max(0, Math.floor(Number(v))) }));
    if (updates.some((u) => !Number.isFinite(u.stock))) {
      toast.error("Stock must be a number");
      return;
    }
    setSaving(true);
    try {
      const res = await sellerCenter.updateStock(updates);
      toast.success(`${res.updated} variant(s) updated`);
      res.results.filter((r) => !r.ok).slice(0, 3).forEach((r) => toast.error(r.error ?? "Failed"));
      setEdits({});
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const res = await sellerCenter.importInventory(file);
      toast.success(`${res.updated} variant(s) updated from the sheet`);
      const failed = res.results.filter((r) => !r.ok);
      if (failed.length) toast.error(`${failed.length} row(s) could not be updated`);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const s = data?.summary;

  return (
    <PageShell>
      <PageHeader
        title="Inventory"
        description="Keep stock accurate so you never have to cancel an order. Low stock means 5 units or fewer."
        actions={
          <>
            <Btn variant="outline" onClick={() => sellerCenter.downloadInventory().catch((e) => toast.error(errorMessage(e)))}>
              <Download className="h-4 w-4" /> Export sheet
            </Btn>
            <Btn variant="outline" loading={importing} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import sheet
            </Btn>
            <input ref={fileRef} type="file" accept=".xlsx" className="sr-only" onChange={(e) => importFile(e.target.files?.[0])} />
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Boxes} tone="navy" label="Total variants" value={s?.totalVariants ?? "—"} sub={s ? `${s.totalUnits.toLocaleString("en-IN")} units in stock` : undefined} />
        <StatCard icon={CheckCircle2} tone="green" label="In stock" value={s?.inStock ?? "—"} />
        <StatCard icon={AlertTriangle} tone="orange" label="Low stock" value={s?.lowStock ?? "—"} />
        <StatCard icon={PackageX} tone="red" label="Out of stock" value={s?.outOfStock ?? "—"} />
      </section>

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="flex flex-col gap-3 px-4 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <Tabs tabs={TABS} value={filter} onChange={(f) => { setFilter(f); setPage(1); }} />
          <div className="flex items-center gap-2 pb-3">
            <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search product or SKU" />
            <Btn variant="brand" loading={saving} disabled={dirty.length === 0} onClick={save}>
              <Save className="h-4 w-4" /> Save{dirty.length ? ` (${dirty.length})` : ""}
            </Btn>
          </div>
        </div>
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading rows={6} />
        ) : !data || data.variants.length === 0 ? (
          <Empty icon={Boxes} title="Nothing here" text="No variants match this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">SKU</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Sold (30 days)</th>
                  <th className="px-3 py-3 font-semibold">Stock lasts</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                </tr>
              </thead>
              <tbody>
                {data.variants.map((v) => {
                  const value = edits[v.variantId] ?? String(v.stock);
                  const changed = edits[v.variantId] !== undefined && Number(edits[v.variantId]) !== v.stock;
                  return (
                    <tr key={v.variantId} className="border-b border-border-soft last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb src={v.image} alt={v.title} />
                          <div className="min-w-0">
                            <p className="max-w-[260px] truncate font-medium">{v.title}</p>
                            <p className="text-xs text-muted-foreground">{[v.size !== "Default" ? `Size ${v.size}` : null, v.color].filter(Boolean).join(" · ") || "Standard"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{v.sku}</td>
                      <td className="px-3 py-3"><StatusBadge status={v.stockStatus} /></td>
                      <td className="px-3 py-3 tabular-nums">{v.soldLast30Days}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {v.daysOfCover === null ? "—" : <span className={cn(v.daysOfCover < 14 && "font-semibold text-brand-strong")}>{v.daysOfCover} days</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" className="h-9 w-9 rounded-lg border border-border-soft hover:bg-mist" aria-label="Decrease" onClick={() => setEdits((e) => ({ ...e, [v.variantId]: String(Math.max(0, Number(value) - 1)) }))}>
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={value}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [v.variantId]: e.target.value }))}
                            className={cn("h-9 w-20 rounded-lg border bg-card px-2 text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/20", changed ? "border-brand" : "border-border-soft")}
                            aria-label={`Stock for ${v.sku}`}
                          />
                          <button type="button" className="h-9 w-9 rounded-lg border border-border-soft hover:bg-mist" aria-label="Increase" onClick={() => setEdits((e) => ({ ...e, [v.variantId]: String(Number(value) + 1) }))}>
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} />
      </div>
    </PageShell>
  );
}
