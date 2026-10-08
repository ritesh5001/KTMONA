"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Gavel } from "lucide-react";
import { adminCenter, type PenaltyRules } from "@/services/admin-center";
import { inr, inr2, fmtDate, shortId } from "@/services/seller-center";
import { Badge, Btn, Empty, ErrorNote, Field, Loading, PageHeader, PageShell, Pager, Panel, errorMessage, inputCls } from "@/components/seller/kit";

const FIELDS: { key: keyof PenaltyRules; label: string; hint: string; unit: string }[] = [
  { key: "lateDispatchPenalty", label: "Late dispatch", hint: "Charged when an order is shipped after its dispatch date.", unit: "₹ per order" },
  { key: "autoCancelAfterHours", label: "Auto-cancel after", hint: "Hours past the dispatch date before an unshipped order is cancelled and refunded. 0 = off.", unit: "hours" },
  { key: "autoCancelPenalty", label: "Auto-cancellation charge", hint: "Charged to the seller for every auto-cancelled order.", unit: "₹ per order" },
  { key: "sellerCancelPenalty", label: "Seller cancellation charge", hint: "Charged when the seller cancels an order (e.g. out of stock).", unit: "₹ per order" },
];

export default function PenaltiesPage() {
  const { data: rules, mutate: mutateRules } = useSWR("admin-penalty-rules", () => adminCenter.penaltyRules());
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const { data, error, isLoading, mutate } = useSWR(["admin-penalties", page], () => adminCenter.penalties({ page }), { keepPreviousData: true });
  const [waiving, setWaiving] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (rules) setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(rules[f.key])])));
  }, [rules]);

  const save = async () => {
    setSaving(true);
    try {
      const next = await adminCenter.savePenaltyRules(Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key] || 0)])) as Partial<PenaltyRules>);
      mutateRules(next, { revalidate: false });
      toast.success("Penalty rules saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const waive = async (id: string) => {
    setWaiving(id);
    try {
      await adminCenter.waivePenalty(id);
      toast.success("Penalty waived");
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setWaiving(null);
    }
  };

  return (
    <PageShell>
      <PageHeader title="Penalties" description="Rules that keep sellers dispatching on time, and every penalty charged. Penalties are deducted from the seller's next payout." />
      <Panel title="Penalty rules" action={<Btn variant="primary" size="sm" loading={saving} onClick={save}>Save rules</Btn>}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FIELDS.map((f) => (
            <Field key={f.key} label={`${f.label} (${f.unit})`} hint={f.hint}>
              <input type="number" min={0} className={inputCls} value={form[f.key] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
            </Field>
          ))}
        </div>
      </Panel>

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
          <h2 className="text-base font-semibold">Penalties charged</h2>
          {data ? <span className="text-sm text-muted-foreground">Total charged: <b className="text-foreground">{inr2.format(data.totalCharged)}</b></span> : null}
        </div>
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : !data || data.entries.length === 0 ? (
          <Empty icon={Gavel} title="No penalties yet" text="Add a manual penalty or credit from a seller's profile." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground"><th className="px-4 py-3 font-semibold">Date</th><th className="px-3 py-3 font-semibold">Seller</th><th className="px-3 py-3 font-semibold">Reason</th><th className="px-3 py-3 font-semibold">Amount</th><th className="px-3 py-3 font-semibold">State</th><th className="px-4 py-3 text-right font-semibold" /></tr></thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-3">{fmtDate(e.createdAt)}</td>
                    <td className="px-3 py-3"><Link href={`/admin/sellers/${e.sellerId}`} className="font-medium hover:text-brand-strong">{e.storeName ?? "Seller"}</Link></td>
                    <td className="px-3 py-3">{e.note}{e.orderId ? <span className="text-xs text-muted-foreground"> · {shortId(e.orderId)}</span> : null}</td>
                    <td className="px-3 py-3 font-semibold tabular-nums text-red-600">{inr.format(e.amount)}</td>
                    <td className="px-3 py-3">{e.waivedAt ? <Badge tone="gray">Waived</Badge> : e.settledAt ? <Badge tone="green">Deducted</Badge> : <Badge tone="orange">Next payout</Badge>}</td>
                    <td className="px-4 py-3 text-right">{!e.waivedAt && !e.settledAt ? <Btn size="sm" variant="outline" loading={waiving === e.id} onClick={() => waive(e.id)}>Waive</Btn> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} />
      </div>
    </PageShell>
  );
}
