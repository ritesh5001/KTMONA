"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CalendarClock, Tag } from "lucide-react";
import { sellerCenter, fmtDate, type SaleEvent } from "@/services/seller-center";
import { Badge, Btn, Empty, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, errorMessage, inputCls } from "@/components/seller/kit";
import { ProductPicker } from "@/components/seller/ProductPicker";
import { cn } from "@/lib/utils";


export default function SellerSaleEventsPage() {
  const { data, error, isLoading, mutate } = useSWR("seller-sale-events", () => sellerCenter.campaigns());
  const [joining, setJoining] = React.useState<SaleEvent | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const leave = async (e: SaleEvent) => {
    setBusy(e.id);
    try {
      await sellerCenter.leaveCampaign(e.id);
      toast.success("You left the sale. Prices are back to normal.");
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
        description="Join KTMONA sales to get your products featured on the sale page. Your discount applies automatically while the sale is live."
      />
      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading rows={3} />
      ) : !data || data.campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border-soft bg-card"><Empty icon={Tag} title="No sale events right now" text="You will see upcoming KTMONA sales here." /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.campaigns.map((e) => (
            <article key={e.id} className="overflow-hidden rounded-2xl border border-border-soft bg-card">
              <div className={cn("relative flex h-28 items-end bg-gradient-to-r from-ink to-navy p-4", e.bannerImage && "bg-cover bg-center")} style={e.bannerImage ? { backgroundImage: `linear-gradient(to top, rgba(12,27,66,.85), rgba(12,27,66,.2)), url(${e.bannerImage})` } : undefined}>
                <div>
                  <span className="inline-block rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-ink">{e.phase === "LIVE" ? "Live now" : e.phase === "UPCOMING" ? "Upcoming" : "Ended"}</span>
                  <h2 className="mt-1 text-lg font-semibold text-white">{e.name}</h2>
                </div>
                <span className="absolute right-4 top-4 rounded-lg bg-brand px-2 py-1 text-xs font-bold text-ink">Min {e.minDiscountPercent}% off</span>
              </div>
              <div className="space-y-3 p-4 text-sm">
                <p className="flex items-center gap-1 text-muted-foreground"><CalendarClock className="h-4 w-4" /> {fmtDate(e.startsAt, true)} → {fmtDate(e.endsAt, true)}</p>
                {e.joinDeadline ? <p className="text-xs text-muted-foreground">Join before {fmtDate(e.joinDeadline, true)}</p> : null}
                {e.description ? <p>{e.description}</p> : null}
                {e.categories.length ? <p className="text-xs text-muted-foreground">Categories: {e.categories.map((c) => c.name).join(", ")}</p> : null}
                {e.participation ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">You joined with {e.participation.products} product(s) at {e.participation.discountPercent}% off</span>
                    {e.phase !== "ENDED" ? <Btn size="sm" variant="outline" loading={busy === e.id} onClick={() => leave(e)}>Leave sale</Btn> : null}
                  </div>
                ) : e.canJoin ? (
                  <Btn variant="brand" onClick={() => setJoining(e)}>Join sale</Btn>
                ) : (
                  <p className="text-xs text-muted-foreground">Joining is closed.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <JoinModal event={joining} onClose={() => setJoining(null)} onJoined={() => mutate()} />
    </PageShell>
  );
}

function JoinModal({ event, onClose, onJoined }: { event: SaleEvent | null; onClose: () => void; onJoined: () => void }) {
  const [discount, setDiscount] = React.useState("");
  const [productIds, setProductIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (event) {
      setDiscount(String(event.minDiscountPercent));
      setProductIds([]);
    }
  }, [event]);
  if (!event) return null;
  const tooLow = Number(discount) < event.minDiscountPercent;
  const submit = async () => {
    setSaving(true);
    try {
      const res = await sellerCenter.joinCampaign(event.id, productIds, Number(discount));
      toast.success(res.skippedVariants ? `Joined. ${res.skippedVariants} variant(s) skipped because the discount is larger than your price.` : "You're in the sale!");
      onJoined();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open wide onClose={onClose} title={`Join ${event.name}`} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="brand" loading={saving} disabled={productIds.length === 0 || tooLow} onClick={submit}>Join sale</Btn></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="Your discount (%)" hint={`At least ${event.minDiscountPercent}%. The discount comes out of your price; KTMONA's commission is unchanged.`} error={tooLow ? `Minimum is ${event.minDiscountPercent}%` : null}>
            <input type="number" min={event.minDiscountPercent} max={80} className={inputCls} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <p className="rounded-xl bg-mist p-3 text-xs text-muted-foreground">
            Prices drop automatically when the sale starts and return to normal when it ends. You can&apos;t change the price of these products while the sale is live.
          </p>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Products</p>
          <ProductPicker selected={productIds} onChange={setProductIds} />
        </div>
      </div>
    </Modal>
  );
}
