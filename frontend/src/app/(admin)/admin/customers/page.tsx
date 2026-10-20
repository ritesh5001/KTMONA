"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Ban, UsersRound } from "lucide-react";
import { adminCenter, type CustomerTab } from "@/services/admin-center";
import { inr, fmtDate } from "@/services/seller-center";
import { Badge, Btn, Empty, ErrorNote, Loading, PageHeader, PageShell, Pager, SearchBox, StatusBadge, Tabs, errorMessage, useDebounced } from "@/components/seller/kit";

const TABS: { key: CustomerTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "cod_off", label: "COD off" },
];

export default function AdminCustomersPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = React.useState<CustomerTab>((TABS.find((t) => t.key === params.get("tab"))?.key ?? "all") as CustomerTab);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data, error, isLoading, mutate } = useSWR(["admin-customers", tab, page, q], () => adminCenter.customers({ tab, page, search: q }), { keepPreviousData: true });

  return (
    <PageShell>
      <PageHeader title="Customers" description="Every buyer account with contact details and order history. Open a customer to suspend, delete, or switch Cash on Delivery off." />
      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="flex flex-col gap-3 px-4 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <Tabs tabs={TABS} value={tab} counts={data?.counts} onChange={(t) => { setTab(t); setPage(1); router.replace(`/admin/customers?tab=${t}`, { scroll: false }); }} />
          <div className="pb-3"><SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name, email or phone" /></div>
        </div>
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading rows={6} />
        ) : !data || data.customers.length === 0 ? (
          <Empty icon={UsersRound} title="No customers here" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Phone</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Orders</th>
                  <th className="px-3 py-3 font-semibold">Spent</th>
                  <th className="px-3 py-3 font-semibold">Last order</th>
                  <th className="px-3 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.id} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${c.id}`} className="font-semibold hover:text-brand-strong">{c.name ?? "No name"}</Link>
                      <p className="text-xs text-muted-foreground">{c.email ?? "No email"}{c.state ? ` · ${c.state}` : ""}</p>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{c.phone ?? "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge status={c.status === "SUSPENDED" ? "CANCELLED" : c.status === "PENDING" ? "PENDING" : "ACTIVE"} />
                        {c.codDisabled ? <Badge tone="red"><Ban className="mr-1 h-3 w-3" />COD off</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{c.orders}</td>
                    <td className="px-3 py-3 tabular-nums">{inr.format(c.spent)}</td>
                    <td className="px-3 py-3 text-xs">{c.lastOrderAt ? fmtDate(c.lastOrderAt) : "—"}</td>
                    <td className="px-3 py-3 text-xs">{fmtDate(c.joinedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/customers/${c.id}`}><Btn size="sm" variant="outline">Open</Btn></Link>
                    </td>
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
