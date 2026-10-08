"use client";

import * as React from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { adminCenter, type QcProduct } from "@/services/admin-center";
import { inr, fmtDate } from "@/services/seller-center";
import { Badge, Btn, Empty, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, Pager, SearchBox, errorMessage, inputCls, useDebounced } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

export default function CatalogQcPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [rejecting, setRejecting] = React.useState<string[] | null>(null);
  const { data, error, isLoading, mutate } = useSWR(["admin-qc", page, q], () => adminCenter.qc({ page, search: q }), { keepPreviousData: true });
  React.useEffect(() => setSelected(new Set()), [page, q]);

  const products = data?.products ?? [];
  const review = async (ids: string[], action: "APPROVE" | "REJECT", reason?: string) => {
    setBusy(true);
    try {
      const res = await adminCenter.qcReview(ids, action, reason);
      toast.success(`${res.done} product(s) ${action === "APPROVE" ? "approved" : "rejected"}`);
      res.results.filter((r) => !r.ok).slice(0, 3).forEach((r) => toast.error(r.error ?? "Failed"));
      setSelected(new Set());
      setRejecting(null);
      await mutate();
      globalMutate((k) => Array.isArray(k) && k[0] === "admin-dashboard");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <PageShell>
      <PageHeader
        title="Catalog QC"
        description="Every new or edited listing is checked here before it goes live. Automatic checks flag missing images, bad MRPs, duplicates and odd prices."
        actions={
          <>
            <div className="w-full sm:w-64"><SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search title" /></div>
            <Link href="/admin/products"><Btn variant="outline">Set listing prices</Btn></Link>
          </>
        }
      />

      {selected.size > 0 ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-card px-4 py-3 shadow-md">
          <span className="mr-2 text-sm font-semibold">{selected.size} selected</span>
          <Btn size="sm" variant="brand" loading={busy} onClick={() => review([...selected], "APPROVE")}><CheckCircle2 className="h-4 w-4" /> Approve all</Btn>
          <Btn size="sm" variant="danger" onClick={() => setRejecting([...selected])}><XCircle className="h-4 w-4" /> Reject all</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Btn>
        </div>
      ) : null}

      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading rows={4} />
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-border-soft bg-card"><Empty icon={ClipboardCheck} title="QC queue is empty" text="New listings will appear here for review." /></div>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={products.every((p) => selected.has(p.id))} onChange={(e) => setSelected(e.target.checked ? new Set(products.map((p) => p.id)) : new Set())} />
            Select all on this page ({data?.pagination.total ?? 0} waiting in total)
          </label>
          <div className="space-y-4">
            {products.map((p) => (
              <QcCard key={p.id} product={p} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} busy={busy} onApprove={() => review([p.id], "APPROVE")} onReject={() => setRejecting([p.id])} />
            ))}
          </div>
          <div className="rounded-2xl border border-border-soft bg-card"><Pager page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} /></div>
        </>
      )}

      <RejectModal ids={rejecting} reasons={data?.reasons ?? []} busy={busy} onClose={() => setRejecting(null)} onConfirm={(reason) => rejecting && review(rejecting, "REJECT", reason)} />
    </PageShell>
  );
}

function QcCard({ product: p, selected, onToggle, busy, onApprove, onReject }: { product: QcProduct; selected: boolean; onToggle: () => void; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const [active, setActive] = React.useState(0);
  const errors = p.flags.filter((f) => f.level === "error").length;
  return (
    <article className={cn("rounded-2xl border bg-card p-4", selected ? "border-brand" : "border-border-soft")}>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex gap-3 lg:w-72 lg:shrink-0">
          <input type="checkbox" aria-label={`Select ${p.title}`} checked={selected} onChange={onToggle} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
          <div className="flex-1">
            <div className="aspect-square overflow-hidden rounded-xl border border-border-soft bg-mist">
              {p.images[active] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[active]} alt={p.title} className="h-full w-full object-cover" />
              ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>}
            </div>
            {p.images.length > 1 ? (
              <div className="mt-2 flex gap-1.5 overflow-x-auto">
                {p.images.slice(0, 8).map((src, i) => (
                  <button key={src + i} type="button" onClick={() => setActive(i)} className={cn("h-11 w-11 shrink-0 overflow-hidden rounded-lg border", i === active ? "border-brand" : "border-border-soft")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">{p.title}</h2>
              <p className="text-xs text-muted-foreground">
                {p.category.name} · <Link href={`/admin/sellers/${p.seller.id}`} className="font-medium text-brand-strong hover:underline">{p.seller.storeName ?? p.seller.code}</Link> · submitted {fmtDate(p.submittedAt)}
                {p.hsnCode ? ` · HSN ${p.hsnCode}` : ""} · GST {p.taxRate}%
              </p>
            </div>
            <div className="flex gap-2">
              {p.isEdit ? <Badge tone="blue">Edit of live product</Badge> : <Badge tone="orange">New listing</Badge>}
              {errors ? <Badge tone="red">{errors} blocking issue(s)</Badge> : null}
            </div>
          </div>
          {p.flags.length ? (
            <div className="flex flex-wrap gap-2">
              {p.flags.map((f) => (
                <span key={f.text} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium", f.level === "error" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-brand/10 text-brand-strong")}>
                  {f.level === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {f.text}
                </span>
              ))}
            </div>
          ) : <p className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> All automatic checks passed</p>}
          {p.description ? <p className="line-clamp-3 text-sm text-muted-foreground">{p.description}</p> : null}
          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead><tr className="bg-mist/60 text-xs text-muted-foreground"><th className="px-3 py-2 font-semibold">Variant</th><th className="px-3 py-2 font-semibold">SKU</th><th className="px-3 py-2 font-semibold">Seller price</th><th className="px-3 py-2 font-semibold">MRP</th><th className="px-3 py-2 font-semibold">Stock</th><th className="px-3 py-2 font-semibold">State</th></tr></thead>
              <tbody>
                {p.variants.map((v) => (
                  <tr key={v.id} className="border-t border-border-soft">
                    <td className="px-3 py-2">{[v.size !== "Default" ? v.size : null, v.color].filter(Boolean).join(" · ") || "Standard"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                    <td className="px-3 py-2 tabular-nums">{inr.format(v.sellerPrice)}</td>
                    <td className="px-3 py-2 tabular-nums">{v.mrp != null ? inr.format(v.mrp) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{v.stock}</td>
                    <td className="px-3 py-2"><Badge tone={v.status === "PENDING" ? "orange" : v.status === "APPROVED" ? "green" : "red"}>{v.status.toLowerCase()}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.categoryMedianPrice != null ? <p className="text-xs text-muted-foreground">Category median price: {inr.format(p.categoryMedianPrice)}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Btn variant="danger" size="sm" onClick={onReject}><XCircle className="h-4 w-4" /> Reject</Btn>
            <Btn variant="brand" size="sm" loading={busy} onClick={onApprove}><CheckCircle2 className="h-4 w-4" /> Approve</Btn>
          </div>
        </div>
      </div>
    </article>
  );
}

function RejectModal({ ids, reasons, busy, onClose, onConfirm }: { ids: string[] | null; reasons: string[]; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  React.useEffect(() => { setReason(reasons[0] ?? ""); setNote(""); }, [ids, reasons]);
  if (!ids) return null;
  const full = note.trim() ? `${reason}. ${note.trim()}` : reason;
  return (
    <Modal open onClose={onClose} title={`Reject ${ids.length} product(s)`} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="danger" loading={busy} disabled={!reason} onClick={() => onConfirm(full)}>Reject</Btn></>}>
      <div className="space-y-4">
        <Field label="QC reason (the seller sees this)">
          <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Extra note (optional)" hint="Tell the seller exactly what to fix.">
          <textarea rows={3} className={`${inputCls} h-auto py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
