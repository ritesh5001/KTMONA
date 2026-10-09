"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { BadgeCheck, Eye, Lock, TrendingDown } from "lucide-react";
import { fmtDate, inr } from "@/services/seller-center";
import { priceLockApi, type PriceLockProduct, type SellerPriceLockTab } from "@/services/platform";
import {
  Badge,
  Btn,
  Empty,
  ErrorNote,
  Loading,
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
  useDebounced,
} from "@/components/seller/kit";

const TABS: { key: SellerPriceLockTab; label: string }[] = [
  { key: "eligible", label: "Add products" },
  { key: "pending", label: "Under review" },
  { key: "approved", label: "Price Locked" },
  { key: "rejected", label: "Not approved" },
];

const BENEFITS = [
  { icon: BadgeCheck, title: "Price Lock badge", text: "Approved products show the KTMONA Price Lock badge on listings and product pages." },
  { icon: Eye, title: "Featured placement", text: "They appear in the Price Lock section of the store, where shoppers look for the best deals." },
  { icon: TrendingDown, title: "Keep it lowest", text: "The badge stays while your price is at or below the approved price. Raising it removes the badge automatically." },
];

export default function SellerPriceLockPage() {
  const [tab, setTab] = React.useState<SellerPriceLockTab>("eligible");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [tab, debounced]);

  const { data, error, isLoading, mutate } = useSWR(["seller-price-lock", tab, page, debounced], () =>
    priceLockApi.sellerList({ tab, page, search: debounced })
  );
  const products = data?.products ?? [];
  const allSelected = products.length > 0 && products.every((p) => selected.includes(p.id));

  const submit = async (ids: string[]) => {
    setBusy(true);
    try {
      const res = await priceLockApi.request(ids);
      const failed = res.results.filter((r) => !r.ok);
      if (res.done) toast.success(`${res.done} product${res.done === 1 ? "" : "s"} sent for Price Lock review`);
      if (failed.length) toast.error(`${failed.length} not sent: ${failed[0]?.error ?? "Check the product"}`);
      setSelected([]);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (ids: string[]) => {
    if (!window.confirm("Remove these products from Price Lock? The badge is removed straight away.")) return;
    setBusy(true);
    try {
      await priceLockApi.withdraw(ids);
      toast.success("Removed from Price Lock");
      setSelected([]);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="KTMONA Price Lock"
        description="List the products you sell at the lowest price in the market. Our team checks each one; approved products get the Price Lock badge and extra visibility."
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="flex gap-3 rounded-2xl border border-border-soft bg-card p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-strong">
              <b.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{b.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{b.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs tabs={TABS} value={tab} onChange={setTab} counts={data?.counts} />
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-80"><SearchBox value={search} onChange={setSearch} placeholder="Search your products" /></div>
          {selected.length > 0 ? (
            tab === "eligible" || tab === "rejected" ? (
              <Btn variant="brand" size="sm" loading={busy} onClick={() => submit(selected)}>
                <Lock className="h-4 w-4" /> Submit {selected.length} for Price Lock
              </Btn>
            ) : (
              <Btn variant="outline" size="sm" loading={busy} onClick={() => withdraw(selected)}>Remove {selected.length}</Btn>
            )
          ) : null}
        </div>

        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : products.length === 0 ? (
          <Empty
            icon={Lock}
            title={tab === "eligible" ? "No products to add" : "Nothing here yet"}
            text={tab === "eligible" ? "Only live (QC-approved) products that are not already in Price Lock appear here." : undefined}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : products.map((p) => p.id))}
                    />
                  </Th>
                  <Th>Product</Th>
                  <Th>Selling price</Th>
                  <Th>{tab === "approved" ? "Locked price" : "MRP"}</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <SellerRow
                    key={p.id}
                    p={p}
                    tab={tab}
                    checked={selected.includes(p.id)}
                    busy={busy}
                    onCheck={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                    onSubmit={() => submit([p.id])}
                    onWithdraw={() => withdraw([p.id])}
                  />
                ))}
              </tbody>
            </Table>
            {data ? <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={setPage} /> : null}
          </>
        )}
      </div>
    </PageShell>
  );
}

function SellerRow({
  p,
  tab,
  checked,
  busy,
  onCheck,
  onSubmit,
  onWithdraw,
}: {
  p: PriceLockProduct;
  tab: SellerPriceLockTab;
  checked: boolean;
  busy: boolean;
  onCheck: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
}) {
  return (
    <tr className="align-top">
      <Td><input type="checkbox" aria-label={`Select ${p.title}`} checked={checked} onChange={onCheck} /></Td>
      <Td>
        <div className="flex items-center gap-3">
          <Thumb src={p.image} alt={p.title} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
            <p className="text-xs text-muted-foreground">{p.category.name}</p>
          </div>
        </div>
      </Td>
      <Td className="text-sm font-semibold">{p.currentPrice != null ? inr.format(p.currentPrice) : "—"}</Td>
      <Td className="text-sm">
        {tab === "approved"
          ? p.lockedPrice != null
            ? inr.format(p.lockedPrice)
            : "—"
          : p.mrp != null
            ? <span className="text-muted-foreground line-through">{inr.format(p.mrp)}</span>
            : "—"}
      </Td>
      <Td className="text-xs">
        {p.status === null ? (
          <span className="text-muted-foreground">Not in Price Lock</span>
        ) : p.status === "PENDING" ? (
          <>
            <Badge tone="orange">Under review</Badge>
            <p className="mt-1 text-muted-foreground">Sent {fmtDate(p.requestedAt)}</p>
          </>
        ) : p.status === "APPROVED" ? (
          p.priceRaised ? (
            <>
              <Badge tone="gray">Badge paused</Badge>
              <p className="mt-1 text-muted-foreground">Your price is above the locked price. Lower it to {p.lockedPrice != null ? inr.format(p.lockedPrice) : "the locked price"} or less to show the badge again.</p>
            </>
          ) : (
            <Badge tone="green">Price Locked</Badge>
          )
        ) : (
          <>
            <Badge tone="gray">Not approved</Badge>
            {p.note ? <p className="mt-1 max-w-xs text-muted-foreground">“{p.note}”</p> : null}
          </>
        )}
      </Td>
      <Td>
        <div className="flex justify-end">
          {tab === "eligible" || tab === "rejected" ? (
            <Btn size="sm" variant={tab === "eligible" ? "brand" : "outline"} disabled={busy} onClick={onSubmit}>
              {tab === "eligible" ? "Submit" : "Resubmit"}
            </Btn>
          ) : (
            <Btn size="sm" variant="ghost" disabled={busy} onClick={onWithdraw}>Remove</Btn>
          )}
        </div>
      </Td>
    </tr>
  );
}
