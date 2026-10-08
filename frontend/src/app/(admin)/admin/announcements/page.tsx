"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { BellRing, Plus } from "lucide-react";
import { adminCenter, type Announcement } from "@/services/admin-center";
import { fmtDate } from "@/services/seller-center";
import { Badge, Btn, Empty, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, errorMessage, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

const LEVEL_TONE = { INFO: "blue", WARNING: "orange", SUCCESS: "green" } as const;

export default function AnnouncementsPage() {
  const { data, error, isLoading, mutate } = useSWR("admin-announcements", () => adminCenter.announcements());
  const [editing, setEditing] = React.useState<Announcement | "new" | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const toggle = async (a: Announcement) => {
    setBusy(a.id);
    try {
      await adminCenter.saveAnnouncement(a.id, { title: a.title, body: a.body, level: a.level, linkUrl: a.linkUrl, linkLabel: a.linkLabel, isActive: !a.isActive, startsAt: a.startsAt, endsAt: a.endsAt });
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const remove = async (a: Announcement) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try {
      await adminCenter.deleteAnnouncement(a.id);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <PageShell>
      <PageHeader
        title="Seller Notices"
        description="Announcements shown at the top of every seller's dashboard: policy changes, sale events, holidays, courier delays."
        actions={<Btn variant="brand" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New notice</Btn>}
      />
      <div className="rounded-2xl border border-border-soft bg-card">
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : !data || data.announcements.length === 0 ? (
          <Empty icon={BellRing} title="No notices yet" />
        ) : (
          <ul className="divide-y divide-border-soft">
            {data.announcements.map((a) => (
              <li key={a.id} className={cn("flex flex-col gap-3 p-5 sm:flex-row sm:items-start", !a.isActive && "opacity-60")}>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={LEVEL_TONE[a.level]}>{a.level.toLowerCase()}</Badge>
                    {!a.isActive ? <Badge tone="gray">Hidden</Badge> : null}
                    <h2 className="text-sm font-semibold">{a.title}</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">From {fmtDate(a.startsAt)}{a.endsAt ? ` to ${fmtDate(a.endsAt)}` : ""}{a.linkUrl ? ` · link: ${a.linkLabel ?? a.linkUrl}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Btn size="sm" variant="outline" onClick={() => setEditing(a)}>Edit</Btn>
                  <Btn size="sm" variant="ghost" loading={busy === a.id} onClick={() => toggle(a)}>{a.isActive ? "Hide" : "Show"}</Btn>
                  <Btn size="sm" variant="danger" onClick={() => remove(a)}>Delete</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <NoticeModal notice={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />
    </PageShell>
  );
}

function NoticeModal({ notice, onClose, onSaved }: { notice: Announcement | "new" | null; onClose: () => void; onSaved: () => void }) {
  const existing = notice && notice !== "new" ? notice : null;
  const [f, setF] = React.useState({ title: "", body: "", level: "INFO" as Announcement["level"], linkUrl: "", linkLabel: "", endsAt: "" });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (!notice) return;
    setF({ title: existing?.title ?? "", body: existing?.body ?? "", level: existing?.level ?? "INFO", linkUrl: existing?.linkUrl ?? "", linkLabel: existing?.linkLabel ?? "", endsAt: existing?.endsAt ? existing.endsAt.slice(0, 10) : "" });
  }, [notice]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!notice) return null;
  const submit = async () => {
    setSaving(true);
    try {
      await adminCenter.saveAnnouncement(existing?.id ?? null, {
        title: f.title,
        body: f.body,
        level: f.level,
        linkUrl: f.linkUrl || null,
        linkLabel: f.linkLabel || null,
        isActive: existing?.isActive ?? true,
        endsAt: f.endsAt ? new Date(`${f.endsAt}T23:59:59`).toISOString() : null,
      });
      toast.success("Notice saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={existing ? "Edit notice" : "New notice"} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="brand" loading={saving} disabled={f.title.trim().length < 3 || f.body.trim().length < 3} onClick={submit}>Save</Btn></>}>
      <div className="space-y-4">
        <Field label="Type">
          <select className={inputCls} value={f.level} onChange={(e) => setF((p) => ({ ...p, level: e.target.value as Announcement["level"] }))}>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning (e.g. policy change, courier delay)</option>
            <option value="SUCCESS">Opportunity (e.g. sale registrations open)</option>
          </select>
        </Field>
        <Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} /></Field>
        <Field label="Message"><textarea rows={3} className={`${inputCls} h-auto py-2`} value={f.body} onChange={(e) => setF((p) => ({ ...p, body: e.target.value }))} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link (optional)" hint="e.g. /seller/sale-events"><input className={inputCls} value={f.linkUrl} onChange={(e) => setF((p) => ({ ...p, linkUrl: e.target.value }))} /></Field>
          <Field label="Link text"><input className={inputCls} value={f.linkLabel} onChange={(e) => setF((p) => ({ ...p, linkLabel: e.target.value }))} placeholder="Join now" /></Field>
        </div>
        <Field label="Hide after (optional)"><input type="date" className={inputCls} value={f.endsAt} onChange={(e) => setF((p) => ({ ...p, endsAt: e.target.value }))} /></Field>
      </div>
    </Modal>
  );
}
