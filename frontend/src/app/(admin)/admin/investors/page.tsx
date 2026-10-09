"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Handshake } from "lucide-react";
import { fmtDate } from "@/services/seller-center";
import { siteApi } from "@/services/platform";
import { Badge, Empty, ErrorNote, Loading, PageHeader, PageShell, Pager, errorMessage, inputCls } from "@/components/seller/kit";

const STATUSES = ["NEW", "CONTACTED", "CLOSED"] as const;
const TONE = { NEW: "orange", CONTACTED: "blue", CLOSED: "gray" } as const;

export default function AdminInvestorsPage() {
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status]);
  const { data, error, isLoading, mutate } = useSWR(["admin-investor-inquiries", status, page], () =>
    siteApi.admin.inquiries({ status, page })
  );

  const update = async (id: string, next: string) => {
    try {
      await siteApi.admin.setInquiryStatus(id, next);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Investor Enquiries"
        description="Messages sent from the Investors page of the website."
        actions={
          <select className={`${inputCls} w-48`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All enquiries</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        }
      />
      <div className="rounded-2xl border border-border-soft bg-card">
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : !data || data.inquiries.length === 0 ? (
          <Empty icon={Handshake} title="No enquiries yet" />
        ) : (
          <>
            <ul className="divide-y divide-border-soft">
              {data.inquiries.map((q) => (
                <li key={q.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{q.name}</h2>
                      {q.organization ? <span className="text-xs text-muted-foreground">· {q.organization}</span> : null}
                      <Badge tone={TONE[q.status as keyof typeof TONE] ?? "gray"}>{q.status.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <a className="hover:underline" href={`mailto:${q.email}`}>{q.email}</a>
                      {q.phone ? ` · ${q.phone}` : ""} · {fmtDate(q.createdAt, true)}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm">{q.message}</p>
                  </div>
                  <select className={`${inputCls} h-9 w-36`} value={q.status} onChange={(e) => update(q.id, e.target.value)} aria-label="Change status">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={setPage} />
          </>
        )}
      </div>
    </PageShell>
  );
}
