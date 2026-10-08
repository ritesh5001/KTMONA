"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { ExternalLink, Plus, Tag } from "lucide-react";
import { getCategories } from "@/services/catalog";
import { adminCenter, type PlatformCampaign } from "@/services/admin-center";
import { inr, fmtDate } from "@/services/seller-center";
import { Badge, Btn, Empty, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, errorMessage, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";


function toLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SaleEventsPage() {
  const { data, error, isLoading, mutate } = useSWR("admin-campaigns", () => adminCenter.campaigns());
  const [editing, setEditing] = React.useState<PlatformCampaign | "new" | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const setStatus = async (c: PlatformCampaign, status: "PUBLISHED" | "CANCELLED" | "DRAFT") => {
    setBusy(c.id);
    try {
      await adminCenter.updateCampaign(c.id, { status });
      toast.success(status === "PUBLISHED" ? "Published. Sellers can now join." : status === "CANCELLED" ? "Sale cancelled. Seller discounts were removed." : "Moved to draft");
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Sale Events"
        description="Run platform-wide sales like a festive Mega Sale. Sellers opt products in with at least the minimum discount; prices change automatically when the sale starts and ends."
        actions={<Btn variant="brand" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New sale event</Btn>}
      />
      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading rows={3} />
      ) : !data || data.campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border-soft bg-card"><Empty icon={Tag} title="No sale events yet" text="Create your first sale event and invite sellers to join." action={<Btn variant="brand" onClick={() => setEditing("new")}>Create sale event</Btn>} /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.campaigns.map((c) => (
            <article key={c.id} className="overflow-hidden rounded-2xl border border-border-soft bg-card">
              <div className={cn("relative flex h-28 items-end bg-gradient-to-r from-ink to-navy p-4", c.bannerImage && "bg-cover bg-center")} style={c.bannerImage ? { backgroundImage: `linear-gradient(to top, rgba(12,27,66,.85), rgba(12,27,66,.2)), url(${c.bannerImage})` } : undefined}>
                <div>
                  <span className="ktm-keep-case inline-block rounded-md bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink">{c.phase}</span>
                  <h2 className="mt-1 text-lg font-semibold text-white">{c.name}</h2>
                </div>
                <span className="absolute right-4 top-4 rounded-lg bg-brand px-2 py-1 text-xs font-bold text-ink">Min {c.minDiscountPercent}% off</span>
              </div>
              <div className="space-y-3 p-4 text-sm">
                <p className="text-muted-foreground">{fmtDate(c.startsAt, true)} → {fmtDate(c.endsAt, true)}{c.joinDeadline ? ` · join by ${fmtDate(c.joinDeadline)}` : ""}</p>
                {c.description ? <p>{c.description}</p> : null}
                <div className="grid grid-cols-4 gap-2 rounded-xl bg-mist p-3 text-center">
                  <div><p className="text-lg font-semibold">{c.sellers}</p><p className="text-xs text-muted-foreground">Sellers</p></div>
                  <div><p className="text-lg font-semibold">{c.products}</p><p className="text-xs text-muted-foreground">Products</p></div>
                  <div><p className="text-lg font-semibold">{c.units}</p><p className="text-xs text-muted-foreground">Units sold</p></div>
                  <div><p className="text-lg font-semibold">{inr.format(c.gmv)}</p><p className="text-xs text-muted-foreground">Sales</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.phase !== "CANCELLED" && c.phase !== "ENDED" ? <Btn size="sm" variant="outline" onClick={() => setEditing(c)}>Edit</Btn> : null}
                  {c.status === "DRAFT" ? <Btn size="sm" variant="brand" loading={busy === c.id} onClick={() => setStatus(c, "PUBLISHED")}>Publish</Btn> : null}
                  {c.status === "PUBLISHED" && c.phase !== "ENDED" ? <Btn size="sm" variant="danger" loading={busy === c.id} onClick={() => setStatus(c, "CANCELLED")}>Cancel sale</Btn> : null}
                  {c.status === "PUBLISHED" ? <a href={`/sale/${c.slug}`} target="_blank" rel="noopener noreferrer"><Btn size="sm" variant="ghost"><ExternalLink className="h-4 w-4" /> Sale page</Btn></a> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <CampaignModal campaign={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />
    </PageShell>
  );
}

function CampaignModal({ campaign, onClose, onSaved }: { campaign: PlatformCampaign | "new" | null; onClose: () => void; onSaved: () => void }) {
  const { data: cats } = useSWR("categories", () => getCategories());
  const existing = campaign && campaign !== "new" ? campaign : null;
  const [f, setF] = React.useState({ name: "", description: "", bannerImage: "", startsAt: "", endsAt: "", joinDeadline: "", minDiscountPercent: "10" });
  const [categoryIds, setCategoryIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (!campaign) return;
    const now = new Date();
    setF({
      name: existing?.name ?? "Mega Blockbuster Sale",
      description: existing?.description ?? "",
      bannerImage: existing?.bannerImage ?? "",
      startsAt: toLocal(existing ? new Date(existing.startsAt) : new Date(now.getTime() + 7 * 86_400_000)),
      endsAt: toLocal(existing ? new Date(existing.endsAt) : new Date(now.getTime() + 12 * 86_400_000)),
      joinDeadline: existing?.joinDeadline ? toLocal(new Date(existing.joinDeadline)) : toLocal(new Date(now.getTime() + 5 * 86_400_000)),
      minDiscountPercent: String(existing?.minDiscountPercent ?? 10),
    });
    setCategoryIds(existing?.categoryIds ?? []);
  }, [campaign]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!campaign) return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const submit = async () => {
    setSaving(true);
    try {
      const body = {
        name: f.name,
        description: f.description || null,
        bannerImage: f.bannerImage || null,
        startsAt: new Date(f.startsAt).toISOString(),
        endsAt: new Date(f.endsAt).toISOString(),
        joinDeadline: f.joinDeadline ? new Date(f.joinDeadline).toISOString() : null,
        minDiscountPercent: Number(f.minDiscountPercent),
        categoryIds,
      };
      if (existing) await adminCenter.updateCampaign(existing.id, body);
      else await adminCenter.createCampaign(body);
      toast.success(existing ? "Sale event updated" : "Sale event created as a draft. Publish it to invite sellers.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open wide onClose={onClose} title={existing ? `Edit ${existing.name}` : "New sale event"} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="brand" loading={saving} disabled={f.name.trim().length < 3} onClick={submit}>{existing ? "Save" : "Create draft"}</Btn></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Name"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
          <Field label="Description (shown to sellers and shoppers)"><textarea rows={3} className={`${inputCls} h-auto py-2`} value={f.description} onChange={set("description")} /></Field>
          <Field label="Banner image URL (optional)"><input className={inputCls} value={f.bannerImage} onChange={set("bannerImage")} placeholder="https://…" /></Field>
          <Field label="Minimum discount (%)" hint="Sellers must offer at least this much off to join."><input type="number" min={1} max={80} className={inputCls} value={f.minDiscountPercent} onChange={set("minDiscountPercent")} /></Field>
        </div>
        <div className="space-y-4">
          <Field label="Sale starts"><input type="datetime-local" className={inputCls} value={f.startsAt} onChange={set("startsAt")} /></Field>
          <Field label="Sale ends"><input type="datetime-local" className={inputCls} value={f.endsAt} onChange={set("endsAt")} /></Field>
          <Field label="Sellers can join until"><input type="datetime-local" className={inputCls} value={f.joinDeadline} onChange={set("joinDeadline")} /></Field>
          <div>
            <p className="mb-1.5 text-sm font-medium">Categories (empty = all)</p>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {(cats?.categories ?? []).map((c) => (
                <button key={c.id} type="button" onClick={() => setCategoryIds((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} className={cn("rounded-full border px-3 py-1 text-xs font-medium", categoryIds.includes(c.id) ? "border-ink bg-ink text-paper dark:border-brand dark:bg-brand dark:text-ink" : "border-border-soft hover:bg-mist")}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
