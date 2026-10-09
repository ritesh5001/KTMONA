"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, BadgePercent, Calculator, Lightbulb, Plus, Tag, ThumbsUp } from "lucide-react";
import { sellerCenter, inr, inr2, fmtDate, type PricingVariant } from "@/services/seller-center";
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
  Panel,
  SearchBox,
  StatusBadge,
  Tabs,
  Thumb,
  errorMessage,
  inputCls,
  useDebounced,
} from "@/components/seller/kit";
import { ProductPicker } from "@/components/seller/ProductPicker";
import { RtoCard } from "@/components/seller/RtoCard";
import { supplier, type PricingPerformance, type PricingProduct, type PricingTab } from "@/services/seller-supplier";
import { cn } from "@/lib/utils";

type View = PricingTab | "offers";

export default function PricingPage() {
  const [view, setView] = React.useState<View>("all");
  const [days, setDays] = React.useState(30);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data: perf, error, isLoading, mutate } = useSWR(
    view === "offers" ? null : ["seller-pricing-perf", view, days, q],
    () => supplier.pricingPerformance({ tab: view as PricingTab, days, search: q }),
    { keepPreviousData: true }
  );
  const { data: rto } = useSWR("seller-pricing-rto", () => supplier.rtoGroups(), { revalidateOnFocus: false });
  const o = perf?.overview;

  return (
    <PageShell>
      <PageHeader
        title="Pricing"
        description="See how your prices compare, what you earn on every product, and where a small price change can bring more orders."
        actions={<SearchBox value={search} onChange={setSearch} placeholder="Search by product or SKU" />}
      />

      <div>
        <h2 className="mb-3 text-base font-semibold">Overview</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border-soft bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Price Performance</h3>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period" className="h-8 rounded-lg border border-border-soft bg-card px-2 text-xs font-semibold">
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-b border-border-soft pb-4">
              <div>
                <p className="text-xs text-muted-foreground">Order Growth</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {o?.orders ?? "–"}{" "}
                  {o?.orderGrowth != null ? (
                    <span className={cn("text-xs", o.orderGrowth >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {o.orderGrowth >= 0 ? "↑" : "↓"} {Math.abs(o.orderGrowth)}%
                    </span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Price suggestions</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{o?.priceSuggestions ?? "–"}</p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Losing Order <span className="tabular-nums">{o?.losingOrders ?? 0} Products</span>
            </p>
            <p className="text-xs text-muted-foreground">Reduce price and increase more orders</p>
          </section>
          <RtoCard rates={rto?.rates} compact />
        </div>
      </div>

      <Calculator_ />

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs
            tabs={[
              { key: "all", label: "All Products" },
              { key: "losing_orders", label: "Losing Orders" },
              { key: "losing_views", label: "Losing Views" },
              { key: "best_priced", label: "Best Priced" },
              { key: "offers", label: "Offers & Discounts" },
            ]}
            value={view}
            onChange={setView}
            counts={perf?.counts}
          />
        </div>
        {view === "offers" ? (
          <OffersView />
        ) : (
          <PricingTable data={perf} error={error} loading={isLoading} onRetry={() => mutate()} />
        )}
      </div>
    </PageShell>
  );
}

function Calculator_() {
  const [price, setPrice] = React.useState("500");
  const debounced = useDebounced(price, 300);
  const n = Number(debounced);
  const { data } = useSWR(n > 0 ? ["seller-calc", n] : null, () => sellerCenter.calculator(n));
  return (
    <Panel>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/12 text-brand-strong">
            <Calculator className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Earnings calculator</p>
            <p className="text-xs text-muted-foreground">Enter your price to see your payout</p>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
            <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className={cn(inputCls, "w-36 pl-7")} aria-label="Your price" />
          </div>
          {data ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">Commission ({data.commissionPct}%): <b className="text-red-600">−{inr2.format(data.commission)}</b></span>
              {data.platformFee ? <span className="text-muted-foreground">Fee: <b className="text-red-600">−{inr2.format(data.platformFee)}</b></span> : null}
              <span>You will earn <b className="text-lg text-emerald-700 dark:text-emerald-400">{inr2.format(data.net)}</b></span>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

const INSIGHT: Record<PricingProduct["insight"], { label: string; cls: string }> = {
  BEST_PRICE: { label: "Best Price", cls: "text-emerald-700 dark:text-emerald-400" },
  LOSING_ORDERS: { label: "Losing Orders", cls: "text-red-600" },
  LOSING_VIEWS: { label: "Losing Views", cls: "text-amber-600" },
};

function PricingTable({
  data,
  error,
  loading,
  onRetry,
}: {
  data: PricingPerformance | undefined;
  error: unknown;
  loading: boolean;
  onRetry: () => void;
}) {
  const [editing, setEditing] = React.useState<PricingVariant | null>(null);
  const variants = React.useMemo(() => data?.products.flatMap((p) => p.variants) ?? [], [data]);

  if (error && !data) return <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={onRetry} /></div>;
  if (loading && !data) return <Loading />;
  if (!data || data.products.length === 0) return <Empty icon={Tag} title="No products here" text="Products matching this tab will show up here." />;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Product Details</th>
              <th className="px-3 py-3 font-semibold">Current Stock</th>
              <th className="px-3 py-3 font-semibold">Growth<br /><span className="font-normal">in {data.days} days</span></th>
              <th className="px-3 py-3 font-semibold">Current Customer Price</th>
              <th className="px-3 py-3 font-semibold">Recommended Price</th>
              <th className="px-3 py-3 font-semibold">Insights</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => {
              const first = p.variants[0]!;
              const recommended = p.variants.find((v) => v.recommendedSellerPrice != null);
              const prices = p.variants.map((v) => v.customerPrice).filter((n): n is number => n != null);
              return (
                <tr key={p.productId} className="border-b border-border-soft align-top last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Thumb src={p.image} alt={p.title} />
                      <div className="min-w-0">
                        <p className="max-w-[260px] truncate font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">Catalog ID: {p.catalogId.slice(-10)}</p>
                        {p.styleCode ? <p className="text-xs text-muted-foreground">Style ID: {p.styleCode}</p> : null}
                        <p className="text-xs text-muted-foreground">Size: {p.sizes.join(", ")}</p>
                        <div className="mt-1 flex gap-1">
                          {p.variants.some((v) => v.status !== "APPROVED") ? <StatusBadge status="UNDER_REVIEW" /> : null}
                          {first.offer ? <Badge tone="orange">{first.offer.discountPercent}% off · {first.offer.name}</Badge> : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{p.stock}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {p.growth == null ? "–" : <span className={p.growth >= 0 ? "text-emerald-600" : "text-red-600"}>{p.growth >= 0 ? "+" : ""}{p.growth}%</span>}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold tabular-nums">{prices.length ? inr.format(Math.min(...prices)) : "—"}</p>
                    <p className="text-xs text-muted-foreground">You earn: {inr2.format(first.earnings.net)}</p>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {recommended ? (
                      <button type="button" className="inline-flex items-center gap-1 font-semibold text-brand-strong hover:underline" onClick={() => setEditing({ ...recommended, sellerPrice: recommended.recommendedSellerPrice! })}>
                        <Lightbulb className="h-3.5 w-3.5" /> {inr.format(recommended.recommendedSellerPrice!)}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", INSIGHT[p.insight].cls)}>
                      <ThumbsUp className="h-3.5 w-3.5" /> {INSIGHT[p.insight].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      {p.variants.map((v) => (
                        <Btn key={v.variantId} size="sm" variant="outline" disabled={v.offer?.status === "ACTIVE"} onClick={() => setEditing(v)}>
                          Edit{p.variants.length > 1 ? ` · ${v.size}` : ""}
                        </Btn>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PriceModal variant={editing} onClose={() => setEditing(null)} onSaved={onRetry} original={variants.find((x) => x.variantId === editing?.variantId) ?? null} />
    </div>
  );
}

function PriceModal({ variant, original, onClose, onSaved }: { variant: PricingVariant | null; original: PricingVariant | null; onClose: () => void; onSaved: () => void }) {
  const [price, setPrice] = React.useState("");
  const [mrp, setMrp] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (variant) {
      setPrice(String(variant.sellerPrice));
      setMrp(variant.mrp != null ? String(variant.mrp) : "");
    }
  }, [variant]);
  const n = Number(price);
  const { data: calc } = useSWR(variant && n > 0 ? ["seller-calc", n] : null, () => sellerCenter.calculator(n));
  if (!variant || !original) return null;
  const increase = n > original.sellerPrice;
  const save = async () => {
    setSaving(true);
    try {
      const res = await sellerCenter.updatePrice(variant.variantId, {
        sellerPrice: n !== original.sellerPrice ? n : undefined,
        mrp: mrp.trim() === "" ? null : Number(mrp),
      });
      toast.success(res.message);
      onSaved();
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
      title="Update price"
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={saving} disabled={!(n > 0)} onClick={save}>Save price</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm font-medium">{variant.title} <span className="text-muted-foreground">({[variant.size, variant.color].filter(Boolean).join(" · ")})</span></p>
        <Field label="Your price (₹)" hint={`Current: ${inr2.format(original.sellerPrice)}`}>
          <input type="number" min={1} className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="MRP (₹, optional)" hint="Shown struck-through to customers. Must be higher than the selling price.">
          <input type="number" min={1} className={inputCls} value={mrp} onChange={(e) => setMrp(e.target.value)} />
        </Field>
        {calc ? (
          <div className="rounded-xl bg-mist p-3 text-sm">
            You will earn <b className="text-emerald-700 dark:text-emerald-400">{inr2.format(calc.net)}</b> per unit after {calc.commissionPct}% commission.
          </div>
        ) : null}
        <p className={cn("text-xs", increase ? "text-brand-strong" : "text-muted-foreground")}>
          {increase
            ? "Price increases are reviewed by KTMONA. The variant is hidden until approved (usually within 24 hours)."
            : "Price cuts go live immediately."}
        </p>
      </div>
    </Modal>
  );
}

function OffersView() {
  const { data, error, isLoading, mutate } = useSWR("seller-offers", () => sellerCenter.offers());
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const cancel = async (id: string) => {
    setBusy(id);
    try {
      await sellerCenter.cancelOffer(id);
      toast.success("Offer ended. Prices restored.");
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-muted-foreground">Discounts come out of your price. KTMONA&apos;s commission is unchanged.</p>
        <Btn variant="brand" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Create offer
        </Btn>
      </div>
      {error && !data ? (
        <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
      ) : isLoading && !data ? (
        <Loading />
      ) : !data || data.offers.length === 0 ? (
        <Empty icon={BadgePercent} title="No offers yet" text="Run a festive sale or clear old stock with a limited-time discount." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Offer</th>
                <th className="px-3 py-3 font-semibold">Discount</th>
                <th className="px-3 py-3 font-semibold">Runs</th>
                <th className="px-3 py-3 font-semibold">Products</th>
                <th className="px-3 py-3 font-semibold">Sold on offer</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {data.offers.map((o) => (
                <tr key={o.id} className="border-b border-border-soft last:border-0">
                  <td className="px-4 py-3 font-semibold">{o.name}</td>
                  <td className="px-3 py-3"><Badge tone="orange">{o.discountPercent}% off</Badge></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{fmtDate(o.startsAt, true)} → {fmtDate(o.endsAt, true)}</td>
                  <td className="px-3 py-3">{o.productCount} ({o.variantCount} variants)</td>
                  <td className="px-3 py-3">{o.unitsSold} units · {o.orders} orders</td>
                  <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {o.status === "ACTIVE" || o.status === "SCHEDULED" ? (
                      <Btn size="sm" variant="danger" loading={busy === o.id} onClick={() => cancel(o.id)}>End offer</Btn>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CreateOfferModal open={creating} onClose={() => setCreating(false)} onCreated={() => mutate()} />
    </div>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CreateOfferModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const now = React.useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [name, setName] = React.useState("Festive Sale");
  const [discount, setDiscount] = React.useState("10");
  const [startsAt, setStartsAt] = React.useState(toLocalInput(now));
  const [endsAt, setEndsAt] = React.useState(toLocalInput(new Date(now.getTime() + 7 * 86_400_000)));
  const [productIds, setProductIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  if (!open) return null;
  const submit = async () => {
    setSaving(true);
    try {
      const res = await sellerCenter.createOffer({
        name,
        discountPercent: Number(discount),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        productIds,
      });
      toast.success(res.skippedVariants ? `Offer created. ${res.skippedVariants} variant(s) skipped (discount larger than your price).` : "Offer created");
      onCreated();
      onClose();
      setProductIds([]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Create offer"
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="brand" loading={saving} disabled={productIds.length === 0 || name.trim().length < 3} onClick={submit}>Create offer</Btn>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Offer name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Discount (%)" hint="1–80%. Applied to the customer price; the same rupee amount comes off your price.">
            <input type="number" min={1} max={80} className={inputCls} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label="Starts">
            <input type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Ends" hint="Up to 60 days.">
            <input type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Products</p>
          <ProductPicker selected={productIds} onChange={setProductIds} />
        </div>
      </div>
    </Modal>
  );
}
