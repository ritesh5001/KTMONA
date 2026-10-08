"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { FileSpreadsheet, Package, Pause, Play, PlusCircle } from "lucide-react";
import { sellerCenter, inr, fmtDate, type CatalogTab } from "@/services/seller-center";
import {
  Btn,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  PageShell,
  Pager,
  SearchBox,
  StatusBadge,
  Tabs,
  Thumb,
  errorMessage,
  useDebounced,
} from "@/components/seller/kit";

const TABS: { key: CatalogTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "under_review", label: "Under Review" },
  { key: "rejected", label: "Rejected" },
  { key: "paused", label: "Paused" },
  { key: "out_of_stock", label: "Out of Stock" },
];

export default function SellerCatalogPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = React.useState<CatalogTab>((TABS.find((t) => t.key === params.get("tab"))?.key ?? "all") as CatalogTab);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  const { data, error, isLoading, mutate } = useSWR(["seller-catalog", tab, page, q], () => sellerCenter.catalog({ tab, page, search: q }), {
    keepPreviousData: true,
  });
  React.useEffect(() => setSelected(new Set()), [tab, page, q]);

  const products = data?.products ?? [];
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setPaused = async (ids: string[], paused: boolean) => {
    setBusy(true);
    try {
      const res = await sellerCenter.setPaused(ids, paused);
      toast.success(`${res.updated} listing(s) ${paused ? "paused" : "resumed"}`);
      await mutate();
      setSelected(new Set());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="My Products"
        description="Track every listing from review to live. Rejected listings show the reason so you can fix and resubmit."
        actions={
          <>
            <Link href="/seller/products/bulk">
              <Btn variant="outline">
                <FileSpreadsheet className="h-4 w-4" /> Bulk upload
              </Btn>
            </Link>
            <Link href="/seller/products/new">
              <Btn variant="brand">
                <PlusCircle className="h-4 w-4" /> Add product
              </Btn>
            </Link>
          </>
        }
      />

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="flex flex-col gap-3 px-4 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <Tabs
            tabs={TABS}
            value={tab}
            onChange={(t) => {
              setTab(t);
              setPage(1);
              router.replace(`/seller/products?tab=${t}`, { scroll: false });
            }}
            counts={data?.counts}
          />
          <div className="pb-3">
            <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search title or SKU" />
          </div>
        </div>

        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-y border-border-soft bg-brand/6 px-4 py-3">
            <span className="mr-2 text-sm font-semibold">{selected.size} selected</span>
            <Btn size="sm" variant="outline" loading={busy} onClick={() => setPaused([...selected], true)}>
              <Pause className="h-4 w-4" /> Pause
            </Btn>
            <Btn size="sm" variant="outline" loading={busy} onClick={() => setPaused([...selected], false)}>
              <Play className="h-4 w-4" /> Resume
            </Btn>
          </div>
        ) : null}

        {error && !data ? (
          <div className="p-4">
            <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
          </div>
        ) : isLoading && !data ? (
          <Loading rows={5} />
        ) : products.length === 0 ? (
          <Empty
            icon={Package}
            title={q ? "No products match" : "No products here"}
            text={tab === "all" && !q ? "List your first product and start selling on KTMONA." : undefined}
            action={
              tab === "all" && !q ? (
                <Link href="/seller/products/new">
                  <Btn variant="brand">Add your first product</Btn>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={products.length > 0 && products.every((p) => selected.has(p.id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(products.map((p) => p.id)) : new Set())}
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Customer price</th>
                  <th className="px-3 py-3 font-semibold">You earn</th>
                  <th className="px-3 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const paused = p.status === "PAUSED";
                  return (
                    <tr key={p.id} className="border-b border-border-soft align-top last:border-0">
                      <td className="px-4 py-4">
                        <input type="checkbox" aria-label={`Select ${p.title}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-[var(--color-brand)]" />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-start gap-3">
                          <Thumb src={p.image} alt={p.title} />
                          <div className="min-w-0">
                            <Link href={`/seller/products/manage?edit=${p.id}`} className="block max-w-[280px] truncate font-medium text-foreground hover:text-brand-strong">
                              {p.title}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {p.category.name} · {p.variantCount} variant{p.variantCount === 1 ? "" : "s"} · Added {fmtDate(p.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <StatusBadge status={p.status} />
                        {p.rejectionReason && (p.status === "REJECTED" || p.status === "REMOVED") ? (
                          <p className="mt-1 max-w-[220px] text-xs text-red-600">Reason: {p.rejectionReason}</p>
                        ) : null}
                        {p.status === "UNDER_REVIEW" ? <p className="mt-1 text-xs text-muted-foreground">Usually live within 72 hours</p> : null}
                      </td>
                      <td className="px-3 py-4 tabular-nums">
                        {p.priceMin != null && p.status !== "UNDER_REVIEW" ? (p.priceMin === p.priceMax ? inr.format(p.priceMin) : `${inr.format(p.priceMin)} – ${inr.format(p.priceMax ?? p.priceMin)}`) : "—"}
                      </td>
                      <td className="px-3 py-4 tabular-nums">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{inr.format(p.youEarnMin)}</span>
                        <p className="text-xs text-muted-foreground">on {inr.format(p.sellerPriceMin)}</p>
                      </td>
                      <td className="px-3 py-4">
                        {p.outOfStock ? <StatusBadge status="OUT_OF_STOCK" /> : <span className="tabular-nums">{p.stock}</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link href={`/seller/products/manage?edit=${p.id}`}>
                            <Btn size="sm" variant="outline">{p.status === "REJECTED" ? "Fix & resubmit" : "Edit"}</Btn>
                          </Link>
                          {p.status === "LIVE" || paused ? (
                            <Btn size="sm" variant="ghost" loading={busy} onClick={() => setPaused([p.id], !paused)}>
                              {paused ? "Resume" : "Pause"}
                            </Btn>
                          ) : null}
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
      {data ? (
        <p className="text-xs text-muted-foreground">
          &ldquo;You earn&rdquo; is your price minus KTMONA&apos;s {data.commission.commissionPct}% commission
          {data.commission.platformFee ? ` and ${inr.format(data.commission.platformFee)} platform fee per order` : ""}.
        </p>
      ) : null}
    </PageShell>
  );
}
