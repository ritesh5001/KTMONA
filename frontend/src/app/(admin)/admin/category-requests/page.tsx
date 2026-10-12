"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { FolderTree } from "lucide-react";
import { fmtDate } from "@/services/seller-center";
import { categoryRequestsApi, type CategoryRequest, type CategoryRequestStatus } from "@/services/platform";
import { Badge, Btn, Empty, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, Pager, Tabs, errorMessage, inputCls } from "@/components/seller/kit";

const TABS: { key: CategoryRequestStatus; label: string }[] = [
  { key: "PENDING", label: "Waiting for review" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];
const TYPE_TONE = { ADD: "green", EDIT: "blue", DELETE: "orange" } as const;
const TYPE_LABEL = { ADD: "Add", EDIT: "Rename / edit", DELETE: "Remove" } as const;

export default function AdminCategoryRequestsPage() {
  const [status, setStatus] = React.useState<CategoryRequestStatus>("PENDING");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status]);
  const { data, error, isLoading, mutate } = useSWR(["admin-category-requests", status, page], () => categoryRequestsApi.adminList({ status, page }));
  const [reviewing, setReviewing] = React.useState<{ req: CategoryRequest; action: "APPROVE" | "REJECT" } | null>(null);

  return (
    <PageShell>
      <PageHeader
        title="Category Requests"
        description="Sellers suggest new categories, renames and removals. Approving applies the change to the live category tree; nothing changes until you approve."
      />
      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2"><Tabs tabs={TABS} value={status} onChange={setStatus} counts={data?.counts} /></div>
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : !data || data.requests.length === 0 ? (
          <Empty icon={FolderTree} title={status === "PENDING" ? "No requests waiting" : "Nothing here yet"} />
        ) : (
          <>
            <ul className="divide-y divide-border-soft">
              {data.requests.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type]}</Badge>
                      <span className="text-sm font-semibold">{r.storeName ?? "Seller"}</span>
                      <span className="text-xs text-muted-foreground">· {fmtDate(r.createdAt, true)}</span>
                    </div>
                    <p className="mt-2 text-sm">
                      {r.type === "ADD" ? (
                        <>New category <strong>“{r.name}”</strong> under <strong>{r.parent?.path ?? "top level"}</strong></>
                      ) : r.type === "EDIT" ? (
                        <>Rename <strong>{r.category?.path}</strong> to <strong>“{r.name}”</strong></>
                      ) : (
                        <>Remove <strong>{r.category?.path}</strong></>
                      )}
                    </p>
                    {r.description ? <p className="mt-1 text-xs text-muted-foreground">Description: {r.description}</p> : null}
                    <p className="mt-1 text-sm text-muted-foreground">Reason: {r.reason}</p>
                    {r.adminNote ? <p className="mt-1 text-xs"><span className="font-semibold">Note:</span> {r.adminNote}</p> : null}
                  </div>
                  {status === "PENDING" ? (
                    <div className="flex gap-2">
                      <Btn size="sm" variant="brand" onClick={() => setReviewing({ req: r, action: "APPROVE" })}>Approve</Btn>
                      <Btn size="sm" variant="outline" onClick={() => setReviewing({ req: r, action: "REJECT" })}>Reject</Btn>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={setPage} />
          </>
        )}
      </div>
      <ReviewModal target={reviewing} onClose={() => setReviewing(null)} onDone={() => mutate()} />
    </PageShell>
  );
}

function ReviewModal({ target, onClose, onDone }: { target: { req: CategoryRequest; action: "APPROVE" | "REJECT" } | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = React.useState("");
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    setNote("");
    setName(target?.req.name ?? "");
  }, [target]);
  if (!target) return null;
  const { req, action } = target;
  const approve = action === "APPROVE";
  const submit = async () => {
    setSaving(true);
    try {
      await categoryRequestsApi.review(req.id, {
        action,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(approve && req.type !== "DELETE" && name.trim() && name.trim() !== req.name ? { name: name.trim() } : {}),
      });
      toast.success(approve ? "Approved and applied" : "Request rejected");
      onDone();
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
      title={approve ? "Approve request" : "Reject request"}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant={approve ? "brand" : "danger"} loading={saving} disabled={!approve && note.trim().length < 3} onClick={submit}>
            {approve ? (req.type === "DELETE" ? "Approve & remove" : "Approve & apply") : "Reject"}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        {approve && req.type !== "DELETE" ? (
          <Field label="Category name" hint="You can tidy the spelling before it goes live.">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        ) : null}
        {approve && req.type === "DELETE" ? (
          <p className="rounded-xl bg-mist p-3 text-sm text-muted-foreground">The category is deleted only if no products use it. Otherwise you&apos;ll see an error and can move its products in Products & Pricing first.</p>
        ) : null}
        <Field label={approve ? "Note for the seller (optional)" : "Why it can't be approved"}>
          <textarea rows={3} className={`${inputCls} h-auto py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
