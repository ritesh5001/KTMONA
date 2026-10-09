"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { BadgeCheck, CheckCircle2, MessageSquareWarning, PackageSearch } from "lucide-react";
import { supplier, type QualityBand } from "@/services/seller-supplier";
import { Btn, Empty, ErrorNote, Loading, PageHeader, PageShell, Panel, SearchBox, Tabs, Thumb, errorMessage, useDebounced } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

const BAND_STYLE: Record<QualityBand, { bar: string; text: string }> = {
  GREEN: { bar: "bg-emerald-200 dark:bg-emerald-900/50", text: "text-emerald-700 dark:text-emerald-300" },
  YELLOW: { bar: "bg-amber-200 dark:bg-amber-900/50", text: "text-amber-700 dark:text-amber-300" },
  RED: { bar: "bg-red-200 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300" },
  BLOCKED: { bar: "bg-red-300 dark:bg-red-900/70", text: "text-red-800 dark:text-red-200" },
};

type Tab = "blocking_soon" | "action_pending" | "fixed";

export default function QualityPage() {
  const [tab, setTab] = React.useState<Tab>("action_pending");
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data, error, isLoading, mutate } = useSWR(["seller-quality", tab, q], () => supplier.quality({ tab, search: q }), { keepPreviousData: true });
  const s = data?.score;

  return (
    <PageShell>
      <PageHeader title="Product Quality" />
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        Quality score updated. Based on ratings from
        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">Trusted and verified customers</span>
      </div>

      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading />
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Panel title="Quality Score">
              <p className="text-sm text-muted-foreground">
                1 and 2 star ratings <b className="text-foreground">{s?.lowRatings ?? 0}</b> • Total Ratings <b className="text-foreground">{s?.totalRatings ?? 0}</b> • Quality Score ={" "}
                <b className="text-foreground">{s?.lowPct == null ? "N/A" : `${s.lowPct}%`}</b>
              </p>
              {s?.lowPct == null ? (
                <div className="my-6 flex flex-col items-center text-center">
                  <BadgeCheck className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">No score available</p>
                  <p className="text-xs text-muted-foreground">You need at least {s?.minRatings ?? 5} ratings in the last 90 days.</p>
                </div>
              ) : (
                <div className="my-6 text-center">
                  <p className={cn("text-4xl font-bold tabular-nums", s.band ? BAND_STYLE[s.band].text : "")}>{s.lowPct}%</p>
                  <p className="text-xs text-muted-foreground">of ratings are 1 or 2 stars</p>
                </div>
              )}
              <div className="grid grid-cols-4 overflow-hidden rounded-full text-center text-[10px] font-semibold">
                {data.bands.map((b) => (
                  <span key={b.key} className={cn("py-1.5", BAND_STYLE[b.key].bar, s?.band === b.key && "ring-2 ring-inset ring-foreground/40")}>
                    {b.visibility.toUpperCase()}
                  </span>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-4 text-center text-xs">
                {data.bands.map((b) => (
                  <div key={b.key}>
                    <p className="font-semibold">{b.label}</p>
                    <p className="text-muted-foreground">{b.to == null ? `More than ${b.from}%` : `${b.from} - ${b.to}%`}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Top Customer Feedback">
              {data.topFeedback.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <MessageSquareWarning className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">No feedback available</p>
                  <p className="text-xs text-muted-foreground">Great work! Continue listing good quality products</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {data.topFeedback.map((f) => (
                    <li key={f.label}>
                      <div className="flex justify-between text-sm">
                        <span>{f.label}</span>
                        <span className="tabular-nums text-muted-foreground">{f.pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mist">
                        <div className="h-full rounded-full bg-red-500" style={{ width: `${f.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="rounded-2xl border border-border-soft bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <h2 className="text-base font-semibold">Quality Recommendations</h2>
              <SearchBox value={search} onChange={setSearch} placeholder="Search by Style / SKU / Catalog ID" />
            </div>
            <div className="flex items-end justify-between gap-2 px-4 pt-2">
              <Tabs
                tabs={[
                  { key: "blocking_soon", label: "Blocking Soon" },
                  { key: "action_pending", label: "Action Pending" },
                  { key: "fixed", label: "Fixed" },
                ]}
                value={tab}
                onChange={setTab}
                counts={data.counts}
              />
              <Link href="/seller/inventory?status=blocked" className="mb-3 shrink-0 text-xs font-semibold text-ink hover:underline dark:text-brand">
                View Blocked Products
              </Link>
            </div>
            {data.products.length === 0 ? (
              <Empty icon={PackageSearch} title="No products as of now" text="Products that have poor quality or listing issues will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Product Details and Quality Score</th>
                      <th className="px-3 py-3 font-semibold">Top Customer Feedback<br /><span className="font-normal">from 1 &amp; 2 star ratings</span></th>
                      <th className="px-3 py-3 font-semibold">Product Listing Improvements</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p.id} className="border-b border-border-soft align-top last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex gap-3">
                            <Thumb src={p.image} alt={p.title} />
                            <div className="min-w-0">
                              <p className="max-w-[240px] truncate font-medium">{p.title}</p>
                              {p.sku ? <p className="text-xs text-muted-foreground">SKU: {p.sku}</p> : null}
                              <p className={cn("mt-1 text-xs font-semibold", p.band ? BAND_STYLE[p.band].text : "text-muted-foreground")}>
                                {p.lowPct == null ? `Score N/A (${p.ratings} ratings)` : `${p.lowPct}% low ratings · ${p.band}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {p.feedback.length ? p.feedback.map((f) => <p key={f.label}>{f.label} ({f.count})</p>) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {p.improvements.length ? (
                            <ul className="list-disc space-y-0.5 pl-4">
                              {p.improvements.map((t) => (
                                <li key={t}>{t}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-emerald-600">Listing looks complete</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/seller/products/manage?edit=${p.id}`}>
                            <Btn size="sm" variant="primary">Improve</Btn>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
