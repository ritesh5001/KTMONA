"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, FileStack, ImageIcon, Lightbulb, Trash2 } from "lucide-react";
import { fmtDate } from "@/services/seller-center";
import { supplier, type CatalogUploadRow, type QcStatus, type QcTab } from "@/services/seller-supplier";
import { Badge, Btn, Empty, ErrorNote, Loading, Modal, Pager, SearchBox, Tabs, errorMessage, useDebounced } from "@/components/seller/kit";
import { useCategoryTree } from "@/components/seller/CategoryColumns";
import { cn } from "@/lib/utils";

type Mode = "bulk" | "single";

const QC_TABS: { key: QcTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "action_required", label: "Action Required" },
  { key: "qc_in_progress", label: "QC in Progress" },
  { key: "qc_error", label: "QC Error" },
  { key: "qc_pass", label: "QC Pass" },
  { key: "draft", label: "Draft" },
];

const QC_BADGE: Record<QcStatus, { tone: "green" | "orange" | "red" | "gray" | "blue"; label: string }> = {
  QC_PASS: { tone: "green", label: "QC Pass" },
  QC_IN_PROGRESS: { tone: "blue", label: "QC in Progress" },
  QC_ERROR: { tone: "red", label: "QC Error" },
  ACTION_REQUIRED: { tone: "orange", label: "Action Required" },
  DRAFT: { tone: "gray", label: "Draft" },
};

export default function CatalogUploadsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = React.useState<Mode>(params.get("mode") === "bulk" ? "bulk" : "single");
  const [tab, setTab] = React.useState<QcTab>((QC_TABS.find((t) => t.key === params.get("tab"))?.key ?? "all") as QcTab);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [categoryId, setCategoryId] = React.useState("");
  const [view, setView] = React.useState<CatalogUploadRow | null>(null);
  const { byId } = useCategoryTree();

  const { data: overview } = useSWR("seller-uploads-overview", () => supplier.uploadsOverview());
  const { data, error, isLoading, mutate } = useSWR(["seller-uploads", mode, tab, page, q, categoryId], () => supplier.uploads({ mode, tab, page, search: q, categoryId }), {
    keepPreviousData: true,
  });

  const changeMode = (m: Mode) => {
    setMode(m);
    setTab("all");
    setPage(1);
    router.replace(`/seller/catalog-uploads?mode=${m}`, { scroll: false });
  };

  const categories = React.useMemo(() => {
    const map = new Map<string, string>();
    data?.uploads.forEach((u) => map.set(u.category.id, u.category.name));
    if (categoryId && !map.has(categoryId)) map.set(categoryId, byId.get(categoryId)?.node.name ?? "Category");
    return [...map.entries()];
  }, [data, categoryId, byId]);

  const removeDraft = async (id: string) => {
    try {
      await supplier.deleteDraft(id);
      toast.success("Draft discarded");
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Upload Catalog</h1>

      <div className="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-gradient-to-r from-brand/15 via-brand/5 to-transparent p-5 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-ink">
          <Lightbulb className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Get up to 50% more orders + up to 10% fewer returns</p>
          <p className="text-sm text-muted-foreground">Add/edit catalogs and improve their quality. Prevent deactivations and low visibility.</p>
        </div>
        <Link href="/seller/quality">
          <Btn variant="primary">Improve products here</Btn>
        </Link>
      </div>

      <section className="rounded-2xl border border-border-soft bg-card p-5">
        <p className="text-sm text-muted-foreground">Have unique products to sell? Choose from the options below</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/seller/catalog-uploads/bulk">
            <Btn variant="primary">Add Catalog in Bulk</Btn>
          </Link>
          <Link href="/seller/catalog-uploads/single">
            <Btn variant="outline">Add Single Catalog</Btn>
          </Link>
        </div>
        <p className="mt-5 text-sm font-semibold">Overview</p>
        <div className="mt-2 grid max-w-xl grid-cols-3 divide-x divide-border-soft rounded-xl border border-border-soft">
          {[
            { label: "Total Uploads Done", value: overview?.total },
            { label: "Using Bulk Uploads", value: overview?.bulk },
            { label: "Using Single Uploads", value: overview?.single },
          ].map((s) => (
            <div key={s.label} className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{s.value ?? "–"}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs
            tabs={[
              { key: "bulk", label: "Bulk Uploads" },
              { key: "single", label: "Single Uploads" },
            ]}
            value={mode}
            onChange={changeMode}
            counts={{ bulk: overview?.bulk ?? 0, single: overview?.single ?? 0 }}
          />
        </div>
        <div className="flex flex-wrap gap-2 border-b border-border-soft px-4 py-3">
          {QC_TABS.filter((t) => mode === "single" || t.key !== "draft").map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium",
                tab === t.key ? "border-brand bg-brand/10 text-foreground" : "border-border-soft text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.key !== "all" ? ` (${data?.counts[t.key] ?? 0})` : ""}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Filter by:</span>
            <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-border-soft bg-card px-2">
              <option value="">Select Category</option>
              {categories.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search By File Id" />
        </div>
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          QC (Quality-Check) error products can be fixed as they appear. Fix QC errors faster to speed up your catalog going live.
        </div>

        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : !data || data.uploads.length === 0 ? (
          <Empty
            icon={FileStack}
            title="No Results"
            text={mode === "bulk" ? "No bulk catalogs yet. Upload a catalog using the Add Catalog in Bulk button above." : "No single catalogs here yet."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">S.no</th>
                  <th className="px-3 py-3 font-semibold">Catalog Image</th>
                  <th className="px-3 py-3 font-semibold">Category</th>
                  <th className="px-3 py-3 font-semibold">File Id</th>
                  <th className="px-3 py-3 font-semibold">Created Date</th>
                  <th className="px-3 py-3 font-semibold">Products</th>
                  <th className="px-3 py-3 font-semibold">QC Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.uploads.map((u, i) => (
                  <tr key={u.id} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-3 tabular-nums">{(page - 1) * 20 + i + 1}</td>
                    <td className="px-3 py-3">
                      <span className="relative block h-14 w-14 overflow-hidden rounded-lg border border-border-soft bg-mist">
                        {u.image ? (
                          <img src={u.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon className="m-auto mt-4 h-5 w-5 text-muted-foreground" />
                        )}
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-ink/75 px-1 text-[10px] font-semibold text-white">{u.imageCount}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">{u.category.name}</td>
                    <td className="px-3 py-3 font-mono text-xs">{u.fileId}</td>
                    <td className="px-3 py-3 text-xs">{fmtDate(u.createdAt, true)}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {u.productCount}
                      {u.rowsFailed ? <span className="block text-xs text-red-600">{u.rowsFailed} failed</span> : null}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={QC_BADGE[u.status].tone}>{QC_BADGE[u.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.status === "DRAFT" ? (
                        <div className="flex gap-2">
                          <Link href={`/seller/catalog-uploads/single?draft=${u.id}`}>
                            <Btn size="sm" variant="primary">Edit Catalog</Btn>
                          </Link>
                          <Btn size="sm" variant="ghost" aria-label="Discard draft" onClick={() => removeDraft(u.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="primary" onClick={() => setView(u)}>
                          View Catalog
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} />
      </div>

      <Modal open={Boolean(view)} onClose={() => setView(null)} title="Catalogs" wide>
        {view ? (
          <div className="space-y-4">
            <div className="text-sm">
              <p><span className="text-muted-foreground">Category:</span> <b>{view.category.name}</b></p>
              <p><span className="text-muted-foreground">File Id:</span> <b className="font-mono">{view.fileId}</b></p>
              {view.fileName ? <p><span className="text-muted-foreground">File:</span> {view.fileName}</p> : null}
            </div>
            <ul className="divide-y divide-border-soft rounded-xl border border-border-soft">
              {view.products.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-mist">
                    {p.image ? (
                      <img src={p.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="text-xs text-muted-foreground">Product ID: {p.id.slice(-10)}</p>
                    {p.reason ? <p className="text-xs text-red-600">{p.reason}</p> : null}
                  </div>
                  <Badge tone={p.status === "APPROVED" ? "green" : p.status === "PENDING" ? "blue" : "red"}>
                    {p.status === "APPROVED" ? "QC Pass" : p.status === "PENDING" ? "QC in Progress" : "QC Error"}
                  </Badge>
                  <Link href={`/seller/inventory?status=${p.status === "APPROVED" ? "active" : p.status === "PENDING" ? "activation_pending" : "blocked"}`}>
                    <Btn size="sm" variant="outline">View</Btn>
                  </Link>
                </li>
              ))}
            </ul>
            {view.errors.length ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-sm">
                <p className="font-semibold text-red-700 dark:text-red-300">Rows with errors</p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                  {view.errors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
