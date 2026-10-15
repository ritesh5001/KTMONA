"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { ChevronRight, FolderPlus, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { getCategories } from "@/services/catalog";
import { buildCategoryTree, type CategoryNode } from "@/lib/category-tree";
import { fmtDate } from "@/services/seller-center";
import { categoryRequestsApi, type CategoryRequest, type CategoryRequestInput } from "@/services/platform";
import { Badge, Btn, Empty, Field, Loading, Modal, PageHeader, PageShell, SearchBox, Tabs, errorMessage, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

type Draft =
  | { type: "ADD"; parent: CategoryNode | null }
  | { type: "EDIT"; category: CategoryNode }
  | { type: "DELETE"; category: CategoryNode };

const STATUS_TONE = { PENDING: "orange", APPROVED: "green", REJECTED: "gray" } as const;
const TYPE_LABEL = { ADD: "New category", EDIT: "Rename / edit", DELETE: "Remove" } as const;

/**
 * Sellers suggest category changes; the KTMONA team approves them before
 * anything changes in the shared category tree every shop and the store use.
 */
export default function SellerCategoryRequestsPage() {
  return (
    <React.Suspense fallback={null}>
      <SellerCategoryRequestsContent />
    </React.Suspense>
  );
}

function SellerCategoryRequestsContent() {
  const [tab, setTab] = React.useState<"browse" | "requests">("browse");
  const cats = useSWR("seller-category-tree", getCategories);
  const reqs = useSWR("seller-category-requests", categoryRequestsApi.mine);
  const tree = React.useMemo(() => buildCategoryTree(cats.data?.categories), [cats.data]);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  // Opened from Add Catalog's "Can't find your category?" link.
  const params = useSearchParams();
  React.useEffect(() => {
    if (params.get("new") === "1") setDraft({ type: "ADD", parent: null });
  }, [params]);
  const pending = (reqs.data?.requests ?? []).filter((r) => r.status === "PENDING").length;

  return (
    <PageShell>
      <PageHeader
        title="Categories"
        description="Can't find the right category for your product, or spot a wrong one? Suggest a new category, a rename or a removal. The KTMONA team reviews every request before it goes live."
        actions={<Btn variant="brand" onClick={() => setDraft({ type: "ADD", parent: null })}><Plus className="h-4 w-4" /> Request new category</Btn>}
      />
      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs
            tabs={[
              { key: "browse", label: "All categories" },
              { key: "requests", label: "My requests" },
            ]}
            value={tab}
            onChange={setTab}
            counts={{ requests: pending || undefined }}
          />
        </div>
        {tab === "browse" ? (
          cats.isLoading && !cats.data ? <Loading /> : <CategoryBrowser tree={tree} onDraft={setDraft} />
        ) : (
          <MyRequests data={reqs.data?.requests} loading={reqs.isLoading} onChange={() => reqs.mutate()} />
        )}
      </div>
      <RequestModal
        draft={draft}
        onClose={() => setDraft(null)}
        onSent={(r) => {
          void reqs.mutate(r, { revalidate: false });
          setTab("requests");
        }}
      />
    </PageShell>
  );
}

function CategoryBrowser({ tree, onDraft }: { tree: CategoryNode[]; onDraft: (d: Draft) => void }) {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const q = search.trim().toLowerCase();

  const matches = (n: CategoryNode): boolean => !q || n.name.toLowerCase().includes(q) || n.children.some(matches);
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const renderNode = (n: CategoryNode): React.ReactNode => {
    if (!matches(n)) return null;
    const expanded = q ? true : open.has(n.id);
    return (
      <li key={n.id}>
        <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-mist" style={{ paddingLeft: 8 + n.depth * 20 }}>
          <button type="button" onClick={() => toggle(n.id)} className={cn("flex h-6 w-6 items-center justify-center rounded", !n.children.length && "invisible")} aria-label={expanded ? "Collapse" : "Expand"}>
            <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
          </button>
          <span className="flex-1 truncate text-sm">{n.name}{n.children.length ? <span className="ml-1 text-xs text-muted-foreground">({n.children.length})</span> : null}</span>
          <span className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
            <button type="button" title="Request sub-category" onClick={() => onDraft({ type: "ADD", parent: n })} className="rounded p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"><FolderPlus className="h-4 w-4" /></button>
            <button type="button" title="Request rename / edit" onClick={() => onDraft({ type: "EDIT", category: n })} className="rounded p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"><Pencil className="h-4 w-4" /></button>
            <button type="button" title="Request removal" onClick={() => onDraft({ type: "DELETE", category: n })} className="rounded p-1.5 text-muted-foreground hover:bg-card hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </span>
        </div>
        {expanded && n.children.length ? <ul>{n.children.map(renderNode)}</ul> : null}
      </li>
    );
  };

  return (
    <div className="p-4">
      <div className="mb-3 sm:w-80"><SearchBox value={search} onChange={setSearch} placeholder="Search categories" /></div>
      {tree.length === 0 ? <Empty icon={FolderTree} title="No categories yet" /> : <ul>{tree.map(renderNode)}</ul>}
      <p className="mt-3 text-xs text-muted-foreground">Hover a category for actions: add a sub-category, rename it, or ask for it to be removed.</p>
    </div>
  );
}

function MyRequests({ data, loading, onChange }: { data?: CategoryRequest[]; loading: boolean; onChange: () => void }) {
  if (loading && !data) return <Loading />;
  if (!data?.length) return <Empty icon={FolderTree} title="No requests yet" text="Requests you send appear here with the team's decision." />;
  const withdraw = async (id: string) => {
    try {
      await categoryRequestsApi.withdraw(id);
      onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <ul className="divide-y divide-border-soft">
      {data.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[r.status]}>{r.status.toLowerCase()}</Badge>
              <span className="text-sm font-semibold">{TYPE_LABEL[r.type]}</span>
            </div>
            <p className="mt-1 text-sm">
              {r.type === "ADD" ? (
                <>“{r.name}” under {r.parent?.path ?? "top level"}</>
              ) : r.type === "EDIT" ? (
                <>{r.category?.path} → “{r.name}”</>
              ) : (
                <>{r.category?.path}</>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Reason: {r.reason} · Sent {fmtDate(r.createdAt)}</p>
            {r.adminNote ? <p className="mt-1 text-xs"><span className="font-semibold">KTMONA team:</span> {r.adminNote}</p> : null}
          </div>
          {r.status === "PENDING" ? <Btn size="sm" variant="ghost" onClick={() => void withdraw(r.id)}>Withdraw</Btn> : null}
        </li>
      ))}
    </ul>
  );
}

function RequestModal({ draft, onClose, onSent }: { draft: Draft | null; onClose: () => void; onSent: (r: { requests: CategoryRequest[] }) => void }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!draft) return;
    setName(draft.type === "EDIT" ? draft.category.name : "");
    setDescription("");
    setReason("");
  }, [draft]);

  if (!draft) return null;

  const title =
    draft.type === "ADD" ? (draft.parent ? `New sub-category in ${draft.parent.name}` : "Request a new category") : draft.type === "EDIT" ? `Rename / edit “${draft.category.name}”` : `Remove “${draft.category.name}”`;
  const valid = reason.trim().length >= 5 && (draft.type === "DELETE" || name.trim().length >= 2);

  const submit = async () => {
    setSaving(true);
    try {
      const input: CategoryRequestInput =
        draft.type === "ADD"
          ? { type: "ADD", parentId: draft.parent?.id ?? null, name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}), reason: reason.trim() }
          : draft.type === "EDIT"
            ? { type: "EDIT", categoryId: draft.category.id, name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}), reason: reason.trim() }
            : { type: "DELETE", categoryId: draft.category.id, reason: reason.trim() };
      const res = await categoryRequestsApi.create(input);
      toast.success("Request sent. The KTMONA team will review it.");
      onSent(res);
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
      onClose={onClose}
      title={title}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant={draft.type === "DELETE" ? "danger" : "brand"} loading={saving} disabled={!valid} onClick={submit}>Send request</Btn>
        </>
      }
    >
      <div className="space-y-4">
        {draft.type !== "DELETE" ? (
          <>
            <Field label={draft.type === "ADD" ? "Category name" : "New name"}>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Banarasi Sarees" maxLength={80} />
            </Field>
            <Field label="Description (optional)">
              <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            </Field>
          </>
        ) : (
          <p className="rounded-xl bg-mist p-3 text-sm text-muted-foreground">A category can only be removed once no products use it. If products are listed in it, the team will move them first.</p>
        )}
        <Field label="Why is this needed?" hint="e.g. I sell 20+ products that don't fit any current category.">
          <textarea rows={3} className={`${inputCls} h-auto py-2`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Modal>
  );
}
