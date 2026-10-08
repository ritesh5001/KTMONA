"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, PauseCircle, Store } from "lucide-react";
import { adminCenter, type SellerTab } from "@/services/admin-center";
import { inr, fmtDate } from "@/services/seller-center";
import { Badge, Btn, Empty, ErrorNote, Loading, PageHeader, PageShell, Pager, SearchBox, StatusBadge, Tabs, errorMessage, useDebounced } from "@/components/seller/kit";

const TABS: { key: SellerTab; label: string }[] = [
  { key: "pending", label: "Pending approval" },
  { key: "kyc_review", label: "KYC to verify" },
  { key: "active", label: "Active" },
  { key: "at_risk", label: "At risk" },
  { key: "suspended", label: "Suspended" },
  { key: "all", label: "All" },
];

export default function AdminSellersPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = React.useState<SellerTab>((TABS.find((t) => t.key === params.get("tab"))?.key ?? "all") as SellerTab);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [busy, setBusy] = React.useState<string | null>(null);
  const { data, error, isLoading, mutate } = useSWR(["admin-sellers", tab, page, q], () => adminCenter.sellers({ tab, page, search: q }), { keepPreviousData: true });

  const approve = async (id: string) => {
    setBusy(id);
    try {
      await adminCenter.setSellerStatus(id, "ACTIVE");
      toast.success("Seller approved");
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell>
      <PageHeader title="Sellers" description="Approve new sellers, verify KYC, and watch seller performance. Open a seller for payouts, penalties, commission and suspension." />
      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="flex flex-col gap-3 px-4 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <Tabs tabs={TABS} value={tab} counts={data?.counts} onChange={(t) => { setTab(t); setPage(1); router.replace(`/admin/sellers?tab=${t}`, { scroll: false }); }} />
          <div className="pb-3"><SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Store, email or phone" /></div>
        </div>
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading rows={6} />
        ) : !data || data.sellers.length === 0 ? (
          <Empty icon={Store} title="No sellers here" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Seller</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">KYC</th>
                  <th className="px-3 py-3 font-semibold">Live products</th>
                  <th className="px-3 py-3 font-semibold">Orders (30d)</th>
                  <th className="px-3 py-3 font-semibold">GMV (30d)</th>
                  <th className="px-3 py-3 font-semibold">Cancel rate</th>
                  <th className="px-3 py-3 font-semibold">Rating</th>
                  <th className="px-4 py-3 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                {data.sellers.map((s) => (
                  <tr key={s.id} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/sellers/${s.id}`} className="font-semibold hover:text-brand-strong">{s.storeName ?? "No store name yet"}</Link>
                      <p className="text-xs text-muted-foreground">{s.sellerCode} · {s.email ?? s.phone} · joined {fmtDate(s.joinedAt)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge status={s.status === "SUSPENDED" ? "CANCELLED" : s.status === "PENDING" ? "PENDING" : "ACTIVE"} />
                        {s.payoutHold ? <Badge tone="red"><PauseCircle className="mr-1 h-3 w-3" />Payout hold</Badge> : null}
                        {s.atRisk ? <Badge tone="orange"><AlertTriangle className="mr-1 h-3 w-3" />At risk</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={s.kycStatus === "VERIFIED" ? "APPROVED" : s.kycStatus === "REJECTED" ? "REJECTED" : "PENDING"} /></td>
                    <td className="px-3 py-3 tabular-nums">{s.liveProducts}</td>
                    <td className="px-3 py-3 tabular-nums">{s.orders30d}</td>
                    <td className="px-3 py-3 tabular-nums">{inr.format(s.gmv30d)}</td>
                    <td className="px-3 py-3 tabular-nums">{s.cancelRate == null ? "—" : `${s.cancelRate}%`}</td>
                    <td className="px-3 py-3 tabular-nums">{s.rating ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {s.status === "PENDING" ? <Btn size="sm" variant="brand" loading={busy === s.id} onClick={() => approve(s.id)}>Approve</Btn> : null}
                        <Link href={`/admin/sellers/${s.id}`}><Btn size="sm" variant="outline">Open</Btn></Link>
                      </div>
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
