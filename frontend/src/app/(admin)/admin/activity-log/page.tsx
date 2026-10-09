"use client";

import * as React from "react";
import useSWR from "swr";
import { History } from "lucide-react";
import { fmtDate } from "@/services/seller-center";
import { staffApi, type ActivityEntry } from "@/services/platform";
import {
  Badge,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  PageShell,
  Pager,
  SearchBox,
  Table,
  Td,
  Th,
  errorMessage,
  inputCls,
  useDebounced,
} from "@/components/seller/kit";

const PANEL_TONE = { admin: "blue", seller: "orange", customer: "gray" } as const;

export default function ActivityLogPage() {
  const [page, setPage] = React.useState(1);
  const [panel, setPanel] = React.useState("");
  const [actorId, setActorId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search);
  const [open, setOpen] = React.useState<string | null>(null);

  React.useEffect(() => setPage(1), [panel, actorId, from, to, debounced]);

  const params = { page, panel, actorId, from, to, search: debounced };
  const { data, error, isLoading, mutate } = useSWR(["admin-activity", params], () => staffApi.activity(params), {
    keepPreviousData: true,
  });
  const actors = useSWR("admin-activity-actors", staffApi.activityActors);

  return (
    <PageShell>
      <PageHeader
        title="Activity Log"
        description="Every change made through the admin and seller panels: who made it, what changed, and when. Entries cannot be edited or deleted."
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-border-soft bg-card p-4 md:grid-cols-2 xl:grid-cols-5">
        <SearchBox value={search} onChange={setSearch} placeholder="Search action, record ID, email…" />
        <select className={inputCls} value={panel} onChange={(e) => setPanel(e.target.value)} aria-label="Panel">
          <option value="">All panels</option>
          <option value="admin">Admin panel</option>
          <option value="seller">Seller panel</option>
        </select>
        <select className={inputCls} value={actorId} onChange={(e) => setActorId(e.target.value)} aria-label="Who">
          <option value="">Everyone (admin team)</option>
          {(actors.data?.actors ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>

      <div className="rounded-2xl border border-border-soft bg-card">
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading rows={8} />
        ) : !data || data.entries.length === 0 ? (
          <Empty icon={History} title="No activity found" text="Changes made from the admin and seller panels appear here." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>Panel</Th>
                  <Th>What changed</Th>
                  <Th>Record</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <ActivityRow key={e.id} entry={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
                ))}
              </tbody>
            </Table>
            <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={setPage} />
          </>
        )}
      </div>
    </PageShell>
  );
}

function ActivityRow({ entry: e, open, onToggle }: { entry: ActivityEntry; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="align-top">
        <Td className="whitespace-nowrap text-xs">{fmtDate(e.at, true)}</Td>
        <Td>
          <p className="text-sm font-medium">{e.actorName}</p>
          <p className="text-xs text-muted-foreground">{e.actorRole}{e.actorLabel && e.actorLabel !== e.actorName ? ` · ${e.actorLabel}` : ""}</p>
        </Td>
        <Td><Badge tone={PANEL_TONE[e.panel] ?? "gray"}>{e.panel}</Badge></Td>
        <Td className="text-sm">{e.action}</Td>
        <Td className="font-mono text-xs text-muted-foreground">{e.entityId ? e.entityId.slice(0, 12) : "—"}</Td>
        <Td>
          <button type="button" className="text-xs font-medium text-brand-strong hover:underline" onClick={onToggle}>
            {open ? "Hide" : "Details"}
          </button>
        </Td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={6} className="bg-mist/50 px-4 py-3">
            <dl className="grid gap-1 text-xs sm:grid-cols-[120px_1fr]">
              <dt className="text-muted-foreground">Request</dt>
              <dd className="font-mono break-all">{e.method} {e.path}</dd>
              <dt className="text-muted-foreground">IP address</dt>
              <dd className="font-mono">{e.ip ?? "—"}</dd>
              <dt className="text-muted-foreground">Submitted values</dt>
              <dd>
                {e.details ? (
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-card p-2 font-mono">{JSON.stringify(e.details, null, 2)}</pre>
                ) : (
                  "—"
                )}
              </dd>
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}
