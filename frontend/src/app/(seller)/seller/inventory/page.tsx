"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Boxes, Check, Download, MoreVertical, Pencil, PlusCircle, Upload } from "lucide-react";
import { sellerCenter, inr } from "@/services/seller-center";
import { supplier, type InventoryCatalog, type InventoryStatus, type InventoryStock } from "@/services/seller-supplier";
import { Btn, Empty, ErrorNote, Loading, Modal, SearchBox, StatusBadge, Tabs, Thumb, errorMessage, useDebounced } from "@/components/seller/kit";
import { useCategoryTree } from "@/components/seller/CategoryColumns";
import { cn } from "@/lib/utils";

const STATUS_TABS: { key: InventoryStatus; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "activation_pending", label: "Activation Pending" },
  { key: "blocked", label: "Blocked" },
  { key: "paused", label: "Paused" },
];
const STOCK_TABS: { key: InventoryStock; label: string }[] = [
  { key: "all", label: "All Stock" },
  { key: "out_of_stock", label: "Out of Stock" },
  { key: "low_stock", label: "Low Stock" },
];

export default function InventoryPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { mutate: globalMutate } = useSWRConfig();
  const [status, setStatus] = React.useState<InventoryStatus>((STATUS_TABS.find((t) => t.key === params.get("status"))?.key ?? "active") as InventoryStatus);
  const [stock, setStock] = React.useState<InventoryStock>(
    (STOCK_TABS.find((t) => t.key === (params.get("stock") ?? params.get("filter")))?.key ?? "all") as InventoryStock
  );
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [categoryId, setCategoryId] = React.useState("");
  const [sort, setSort] = React.useState("orders");
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const { byId } = useCategoryTree();

  const { data, error, isLoading, mutate } = useSWR(["seller-inventory-catalogs", status, stock, q, categoryId, sort], () =>
    supplier.inventoryCatalogs({ status, stock, search: q, categoryId, sort }), { keepPreviousData: true }
  );
  const catalogs = React.useMemo(() => data?.catalogs ?? [], [data]);
  const selected = catalogs.find((c) => c.key === selectedKey) ?? catalogs[0] ?? null;

  const usedCategories = React.useMemo(() => {
    const ids = new Map<string, string>();
    catalogs.forEach((c) => ids.set(c.category.id, c.category.name));
    if (categoryId && !ids.has(categoryId)) ids.set(categoryId, byId.get(categoryId)?.node.name ?? "Category");
    return [...ids.entries()];
  }, [catalogs, categoryId, byId]);

  const refresh = () => Promise.all([mutate(), globalMutate((k) => Array.isArray(k) && k[0] === "seller-home")]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search by Catalog ID / Style ID / SKU ID" />
          <Link href="/seller/catalog-uploads">
            <Btn variant="primary">
              <Upload className="h-4 w-4" /> Catalog Upload
            </Btn>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs
            tabs={STATUS_TABS}
            value={status}
            onChange={(k) => {
              setStatus(k);
              setSelectedKey(null);
              router.replace(`/seller/inventory?status=${k}`, { scroll: false });
            }}
            counts={data?.statusCounts}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {STOCK_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setStock(t.key);
                  setSelectedKey(null);
                }}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium",
                  stock === t.key ? "border-brand bg-brand/10 text-foreground" : "border-border-soft text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label} ({data?.stockCounts[t.key] ?? 0})
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:underline dark:text-brand">
            <Boxes className="h-4 w-4" /> Bulk Stock Update
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Filter by :</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-9 rounded-lg border border-border-soft bg-card px-2">
              <option value="">Select Category</option>
              {usedCategories.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Sort catalogs by :</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 rounded-lg border border-border-soft bg-card px-2">
              <option value="orders">Highest Estimated Orders</option>
              <option value="stock">Lowest Stock</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>

        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading rows={5} />
        ) : catalogs.length === 0 ? (
          <Empty
            icon={Boxes}
            title="No catalogs here"
            text={q ? "Nothing matches your search." : "Catalogs in this state will show up here."}
            action={
              <Link href="/seller/catalog-uploads">
                <Btn variant="primary">Upload catalog</Btn>
              </Link>
            }
          />
        ) : (
          <div className="grid border-t border-border-soft md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="max-h-[70vh] overflow-y-auto border-b border-border-soft md:border-b-0 md:border-r">
              <p className="sticky top-0 z-10 border-b border-border-soft bg-mist/80 px-4 py-2.5 text-xs font-semibold text-muted-foreground backdrop-blur">
                Catalog: {STOCK_TABS.find((t) => t.key === stock)?.label}
              </p>
              {catalogs.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelectedKey(c.key)}
                  className={cn("flex w-full gap-3 border-b border-border-soft px-4 py-3 text-left", selected?.key === c.key ? "bg-brand/8" : "hover:bg-mist/50")}
                >
                  <Thumb src={c.image} alt={c.title} />
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-semibold">{c.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">Catalog ID: {c.catalogId.slice(-12)}</span>
                    <span className="block truncate text-xs text-muted-foreground">Category: {c.category.name}</span>
                  </span>
                </button>
              ))}
            </div>
            {selected ? <CatalogSkus catalog={selected} lowThreshold={data?.lowStockThreshold ?? 5} status={status} onChanged={refresh} /> : null}
          </div>
        )}
      </div>

      <BulkStockModal open={bulkOpen} onClose={() => setBulkOpen(false)} onDone={refresh} />
    </div>
  );
}

function CatalogSkus({ catalog, lowThreshold, status, onChanged }: { catalog: InventoryCatalog; lowThreshold: number; status: InventoryStatus; onChanged: () => void }) {
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [menu, setMenu] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => {
    setEdits({});
    setChecked(new Set());
  }, [catalog.key]);

  const rows = catalog.products.flatMap((p) => p.variants.map((v) => ({ p, v })));

  const saveStock = async (updates: { variantId: string; stock: number }[], label: string) => {
    setBusy(label);
    try {
      const res = await sellerCenter.updateStock(updates);
      const failed = res.results.filter((r) => !r.ok);
      if (res.updated) toast.success(`Stock updated for ${res.updated} SKU(s)`);
      failed.slice(0, 3).forEach((f) => toast.error(f.error ?? "Failed"));
      setEdits({});
      setChecked(new Set());
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const pause = async (productId: string, paused: boolean) => {
    setMenu(null);
    setBusy(productId);
    try {
      await sellerCenter.setPaused([productId], paused);
      toast.success(paused ? "Listing paused" : "Listing resumed");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{catalog.title}</p>
          <p className="text-xs text-muted-foreground">
            Catalog ID: {catalog.catalogId.slice(-12)} | Category: {catalog.category.name}
          </p>
        </div>
        {checked.size ? (
          <div className="flex gap-2">
            <Btn size="sm" variant="danger" loading={busy === "oos"} onClick={() => saveStock([...checked].map((variantId) => ({ variantId, stock: 0 })), "oos")}>
              Mark out of stock ({checked.size})
            </Btn>
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={rows.length > 0 && rows.every((r) => checked.has(r.v.variantId))}
                  onChange={(e) => setChecked(e.target.checked ? new Set(rows.map((r) => r.v.variantId)) : new Set())}
                />
              </th>
              <th className="px-3 py-3 font-semibold">SKU</th>
              <th className="px-3 py-3 font-semibold">Variation</th>
              <th className="px-3 py-3 font-semibold">Estimated Order Per Day</th>
              <th className="px-3 py-3 font-semibold">Days to Stockout</th>
              <th className="px-3 py-3 font-semibold">Stock</th>
              <th className="px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, v }) => {
              const value = edits[v.variantId] ?? String(v.stock);
              const dirty = edits[v.variantId] !== undefined && Number(edits[v.variantId]) !== v.stock;
              return (
                <tr key={v.variantId} className="border-b border-border-soft align-top last:border-0">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${v.sku}`}
                      checked={checked.has(v.variantId)}
                      onChange={() =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(v.variantId)) next.delete(v.variantId);
                          else next.add(v.variantId);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-3">
                      <Thumb src={p.image} alt={p.title} />
                      <div className="min-w-0">
                        <p className="line-clamp-2 max-w-[220px] font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">SKU: {v.sku}</p>
                        {p.styleCode ? <p className="text-xs text-muted-foreground">Style ID: {p.styleCode}</p> : null}
                        <p className="text-xs text-muted-foreground">KTMONA Price: {v.customerPrice != null ? inr.format(v.customerPrice) : "In review"}</p>
                        {status !== "active" ? (
                          <div className="mt-1"><StatusBadge status={p.status} /></div>
                        ) : null}
                        {p.rejectionReason ? <p className="mt-1 max-w-[220px] text-xs text-red-600">{p.rejectionReason}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">{[v.size, v.color].filter(Boolean).join(" / ")}</td>
                  <td className="px-3 py-3 tabular-nums">{v.estimatedOrdersPerDay || "-"}</td>
                  <td className="px-3 py-3 tabular-nums">{v.daysToStockout ?? "-"}</td>
                  <td className="px-3 py-3">
                    <label className="block w-28">
                      <span className="text-[10px] text-muted-foreground">Current Stock</span>
                      <span className={cn("flex items-center rounded-lg border bg-card pr-1", v.stock <= 0 ? "border-red-500/50" : v.stock <= lowThreshold ? "border-amber-500/60" : "border-border-soft")}>
                        <input
                          type="number"
                          min={0}
                          value={value}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [v.variantId]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && dirty) void saveStock([{ variantId: v.variantId, stock: Math.max(0, Math.floor(Number(value))) }], v.variantId);
                          }}
                          aria-label={`Stock for ${v.sku}`}
                          className="h-9 w-full rounded-lg bg-transparent px-2 text-sm tabular-nums focus:outline-none"
                        />
                        {dirty ? (
                          <button
                            type="button"
                            aria-label="Save stock"
                            onClick={() => saveStock([{ variantId: v.variantId, stock: Math.max(0, Math.floor(Number(value))) }], v.variantId)}
                            className="rounded-md bg-ink p-1 text-paper dark:bg-brand dark:text-ink"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </span>
                    </label>
                  </td>
                  <td className="relative px-3 py-3">
                    <div className="flex flex-col items-start gap-1.5 text-sm">
                      <Link href={`/seller/products/manage?edit=${p.productId}`} className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand-strong">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Link>
                      <button type="button" onClick={() => setMenu(menu === v.variantId ? null : v.variantId)} className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand-strong">
                        <MoreVertical className="h-3.5 w-3.5" /> More
                      </button>
                    </div>
                    {menu === v.variantId ? (
                      <div className="absolute right-3 top-16 z-20 w-48 overflow-hidden rounded-xl border border-border-soft bg-popover py-1 text-sm shadow-lg">
                        <Link href={`/seller/products/manage?edit=${p.productId}`} className="flex items-center gap-2 px-3 py-2 hover:bg-accent">
                          <PlusCircle className="h-4 w-4" /> Add New Variation
                        </Link>
                        {status === "active" ? (
                          <button type="button" disabled={busy === p.productId} onClick={() => pause(p.productId, true)} className="block w-full px-3 py-2 text-left hover:bg-accent">
                            Pause listing
                          </button>
                        ) : status === "paused" ? (
                          <button type="button" disabled={busy === p.productId} onClick={() => pause(p.productId, false)} className="block w-full px-3 py-2 text-left hover:bg-accent">
                            Resume listing
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setMenu(null);
                            void saveStock([{ variantId: v.variantId, stock: 0 }], "oos");
                          }}
                          className="block w-full px-3 py-2 text-left text-red-600 hover:bg-accent"
                        >
                          Mark out of stock
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkStockModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = React.useState<"download" | "upload" | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    try {
      const res = await sellerCenter.importInventory(file);
      const failed = res.results.filter((r) => !r.ok);
      toast.success(`Stock updated for ${res.updated} SKU(s)`);
      if (failed.length) toast.error(`${failed.length} row(s) failed: ${failed[0]?.error ?? ""}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Bulk Stock Update">
      <div className="divide-y divide-border-soft">
        <div className="flex items-center justify-between gap-4 pb-4">
          <div>
            <p className="text-sm font-semibold">Step 1</p>
            <p className="text-xs text-muted-foreground">Download file with existing stock</p>
          </div>
          <Btn
            variant="primary"
            loading={busy === "download"}
            onClick={async () => {
              setBusy("download");
              try {
                await sellerCenter.downloadInventory();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            <Download className="h-4 w-4" /> Download
          </Btn>
        </div>
        <div className="flex items-center justify-between gap-4 pt-4">
          <div>
            <p className="text-sm font-semibold">Step 2</p>
            <p className="text-xs text-muted-foreground">Update the file with current stock and upload it back</p>
          </div>
          <Btn variant="primary" loading={busy === "upload"} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload
          </Btn>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>
    </Modal>
  );
}
