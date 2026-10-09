"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { fmtDate, inr } from "@/services/seller-center";
import { priceLockApi, type AdminPriceLockProduct, type PriceLockStatus } from "@/services/platform";
import {
  Badge,
  Btn,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  PageShell,
  Pager,
  SearchBox,
  Table,
  Tabs,
  Td,
  Th,
  Thumb,
  errorMessage,
  inputCls,
  useDebounced,
} from "@/components/seller/kit";

const TABS: { key: PriceLockStatus; label: string }[] = [
  { key: "PENDING", label: "Waiting for review" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export default function AdminPriceLockPage() {
  const [status, setStatus] = React.useState<PriceLockStatus>("PENDING");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [rejecting, setRejecting] = React.useState<{ ids: string[]; action: "REJECT" | "REVOKE" } | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [status, debounced]);

  const { data, error, isLoading, mutate } = useSWR(["admin-price-lock", status, page, debounced], () =>
    priceLockApi.adminQueue({ status, page, search: debounced })
  );

  const approve = async (ids: string[]) => {
    setBusy(true);
    try {
      const res = await priceLockApi.review(ids, "APPROVE");
      toast.success(`${res.done} product${res.done === 1 ? "" : "s"} approved for Price Lock`);
      setSelected([]);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const products = data?.products ?? [];
  const allSelected = products.length > 0 && products.every((p) => selected.includes(p.id));

  return (
    <PageShell>
      <PageHeader
        title="KTMONA Price Lock"
        description="Sellers nominate products they sell at the lowest price in the market. Approved products get the Price Lock badge and appear in the Price Lock section of the store. The badge drops automatically if the seller raises the price above the approved price."
      />

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs tabs={TABS} value={status} onChange={setStatus} counts={data?.counts} />
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-80"><SearchBox value={search} onChange={setSearch} placeholder="Search product title" /></div>
          {selected.length > 0 && status === "PENDING" ? (
            <div className="flex gap-2">
              <Btn variant="brand" size="sm" loading={busy} onClick={() => approve(selected)}>Approve {selected.length}</Btn>
              <Btn variant="outline" size="sm" onClick={() => setRejecting({ ids: selected, action: "REJECT" })}>Reject {selected.length}</Btn>
            </div>
          ) : null}
        </div>

        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : products.length === 0 ? (
          <Empty icon={Lock} title={status === "PENDING" ? "No requests waiting" : "Nothing here yet"} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  {status === "PENDING" ? (
                    <Th>
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : products.map((p) => p.id))}
                      />
                    </Th>
                  ) : null}
                  <Th>Product</Th>
                  <Th>Seller</Th>
                  <Th>Price today</Th>
                  <Th>Lowest from other sellers</Th>
                  <Th>{status === "PENDING" ? "Requested" : "Reviewed"}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <Row
                    key={p.id}
                    p={p}
                    status={status}
                    checked={selected.includes(p.id)}
                    onCheck={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                    onApprove={() => approve([p.id])}
                    onReject={(action) => setRejecting({ ids: [p.id], action })}
                    busy={busy}
                  />
                ))}
              </tbody>
            </Table>
            {data ? <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={setPage} /> : null}
          </>
        )}
      </div>

      <RejectModal
        target={rejecting}
        onClose={() => setRejecting(null)}
        onDone={() => {
          setSelected([]);
          mutate();
        }}
      />
    </PageShell>
  );
}

function Row({
  p,
  status,
  checked,
  onCheck,
  onApprove,
  onReject,
  busy,
}: {
  p: AdminPriceLockProduct;
  status: PriceLockStatus;
  checked: boolean;
  onCheck: () => void;
  onApprove: () => void;
  onReject: (action: "REJECT" | "REVOKE") => void;
  busy: boolean;
}) {
  const cheaperElsewhere =
    p.currentPrice != null && p.lowestOtherSellerPrice != null && p.lowestOtherSellerPrice < p.currentPrice;
  return (
    <tr>
      {status === "PENDING" ? (
        <Td><input type="checkbox" aria-label={`Select ${p.title}`} checked={checked} onChange={onCheck} /></Td>
      ) : null}
      <Td>
        <div className="flex items-center gap-3">
          <Thumb src={p.image} alt={p.title} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
            <p className="text-xs text-muted-foreground">{p.category.name}</p>
          </div>
        </div>
      </Td>
      <Td className="text-sm">{p.seller.storeName ?? "—"}</Td>
      <Td>
        <p className="text-sm font-semibold">{p.currentPrice != null ? inr.format(p.currentPrice) : "—"}</p>
        {status === "APPROVED" && p.lockedPrice != null ? (
          <p className="text-xs text-muted-foreground">Locked at {inr.format(p.lockedPrice)}</p>
        ) : null}
        {p.priceRaised ? <Badge tone="orange">Price raised — badge hidden</Badge> : null}
      </Td>
      <Td>
        {p.lowestOtherSellerPrice != null ? (
          <span className={cheaperElsewhere ? "text-sm font-semibold text-red-600" : "text-sm"}>
            {inr.format(p.lowestOtherSellerPrice)}
            {cheaperElsewhere ? <span className="block text-xs font-normal">Cheaper elsewhere on KTMONA</span> : null}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No other sellers</span>
        )}
      </Td>
      <Td className="text-xs">
        {fmtDate(status === "PENDING" ? p.requestedAt : p.reviewedAt, true)}
        {p.note ? <p className="mt-1 text-muted-foreground">“{p.note}”</p> : null}
      </Td>
      <Td>
        <div className="flex justify-end gap-2">
          {status === "PENDING" ? (
            <>
              <Btn size="sm" variant="brand" disabled={busy} onClick={onApprove}>Approve</Btn>
              <Btn size="sm" variant="outline" onClick={() => onReject("REJECT")}>Reject</Btn>
            </>
          ) : status === "APPROVED" ? (
            <Btn size="sm" variant="outline" onClick={() => onReject("REVOKE")}>Revoke</Btn>
          ) : (
            <Btn size="sm" variant="outline" disabled={busy} onClick={onApprove}>Approve</Btn>
          )}
        </div>
      </Td>
    </tr>
  );
}

function RejectModal({
  target,
  onClose,
  onDone,
}: {
  target: { ids: string[]; action: "REJECT" | "REVOKE" } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setNote(""), [target]);
  if (!target) return null;
  const submit = async () => {
    setSaving(true);
    try {
      await priceLockApi.review(target.ids, target.action, note);
      toast.success(target.action === "REVOKE" ? "Price Lock revoked" : "Request rejected");
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
      title={target.action === "REVOKE" ? "Revoke Price Lock" : `Reject ${target.ids.length} request${target.ids.length === 1 ? "" : "s"}`}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" loading={saving} disabled={note.trim().length < 3} onClick={submit}>
            {target.action === "REVOKE" ? "Revoke" : "Reject"}
          </Btn>
        </>
      }
    >
      <Field label="Note for the seller" hint="e.g. The same product is available cheaper on other marketplaces.">
        <textarea rows={3} className={`${inputCls} h-auto py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
