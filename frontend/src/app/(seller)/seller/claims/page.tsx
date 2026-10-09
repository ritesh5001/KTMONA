"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { BadgeCheck, CheckCircle2, FileWarning, PackageSearch, PlusCircle, ShieldCheck, Sparkles } from "lucide-react";
import { sellerCenter, inr, fmtDate, shortId } from "@/services/seller-center";
import { Btn, Empty, ErrorNote, Loading, PageHeader, PageShell, Pager, Panel, StatusBadge, Tabs, errorMessage } from "@/components/seller/kit";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const TYPE_LABEL: Record<string, string> = {
  DAMAGED_RETURN: "Damaged return",
  WRONG_RETURN: "Wrong return",
  MISSING_ITEM_IN_RETURN: "Item missing in return",
  RTO_DAMAGED: "RTO damaged",
  RTO_NOT_RECEIVED: "RTO not received",
  PAYMENT_ISSUE: "Payment issue",
  OTHER: "Other",
};

const FEATURES = [
  { icon: PackageSearch, title: "Transparent Barcoded Packaging", text: "Using transparent, barcoded packaging helps reduce wrong returns and speeds up claim approval." },
  { icon: BadgeCheck, title: "Extensive Quality Checks", text: "Thorough checks at every step to stop fraudulent returns." },
  { icon: ShieldCheck, title: "Secured Ecosystem", text: "Strict action against suspicious courier partners or customers." },
  { icon: Sparkles, title: "Improved Claims Experience", text: "Rejected tickets are double-checked to get you the best approval rate." },
];

export default function ClaimsPage() {
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const { data, error, isLoading, mutate } = useSWR(["seller-claims", status, page], () => sellerCenter.claims({ status, page }), { keepPreviousData: true });
  const counts = data?.counts ?? {};

  return (
    <PageShell>
      <PageHeader
        title="Claims"
        actions={
          <Link href="/seller/support?topic=returns">
            <Btn variant="primary">
              <PlusCircle className="h-4 w-4" /> Raise Claim
            </Btn>
          </Link>
        }
      />

      <section className="grid gap-6 rounded-2xl border border-border-soft bg-card p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
        <div>
          <h2 className="text-xl font-semibold">Raising claims is super-easy on KTMONA</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {["Cut down on losses due to wrong returns", "Transparent resolution process", "Up to 100% claim approval rate*"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {t}
              </li>
            ))}
          </ul>
          <Link href="/seller/support?topic=returns" className="mt-5 inline-block">
            <Btn variant="primary">
              <PlusCircle className="h-4 w-4" /> Raise Claim
            </Btn>
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">*Applicable only on genuine claims</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Open", value: (counts.open ?? 0) + (counts.under_review ?? 0) },
            { label: "Approved", value: counts.approved ?? 0 },
            { label: "Rejected", value: counts.rejected ?? 0 },
            { label: "Total claims", value: counts.all ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border-soft bg-mist/40 p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs tabs={STATUS_TABS} value={status} onChange={(k) => { setStatus(k); setPage(1); }} counts={counts} />
        </div>
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : !data || data.claims.length === 0 ? (
          <Empty icon={FileWarning} title="No claims yet" text="Raise a claim when a return or RTO comes back damaged, wrong or missing." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Claim</th>
                  <th className="px-3 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Issue</th>
                  <th className="px-3 py-3 font-semibold">Claimed</th>
                  <th className="px-3 py-3 font-semibold">Approved</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.claims.map((c) => (
                  <tr key={c.id} className="border-b border-border-soft align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c.claimNumber}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}</p>
                    </td>
                    <td className="px-3 py-3">{shortId(c.orderId)}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{TYPE_LABEL[c.type] ?? c.type}</p>
                      <p className="line-clamp-2 max-w-xs text-xs text-muted-foreground">{c.description}</p>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{c.amountClaimed != null ? inr.format(c.amountClaimed) : "—"}</td>
                    <td className="px-3 py-3 tabular-nums">{c.amountApproved != null ? inr.format(c.amountApproved) : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                      {c.resolutionNote ? <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">{c.resolutionNote}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} />
      </div>

      <Panel title="Recently Enhanced Features">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-strong">
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}
