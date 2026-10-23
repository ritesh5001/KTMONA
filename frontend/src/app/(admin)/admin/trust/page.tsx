"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  answerAdminQuestion,
  listAdminQuestions,
  listProductReports,
  listReportedReviews,
  resolveProductReport,
  resolveReportedReview,
  setAdminQuestionHidden,
  type AdminProductQuestion,
  type AdminProductReport,
  type ReportedReview,
} from "@/services/admin-trust";

type Tab = "reviews" | "reports" | "questions";

const REPORT_LABEL: Record<string, string> = {
  WRONG_PRICE: "Price is wrong",
  WRONG_SPECS: "Details / specs wrong",
  WRONG_IMAGES: "Photos don't match",
  FAKE_OR_COUNTERFEIT: "Possibly fake / counterfeit",
  OFFENSIVE: "Offensive",
  OTHER: "Other",
  SPAM: "Spam",
  FAKE: "Fake review",
  NOT_ABOUT_PRODUCT: "Not about the product",
  PERSONAL_INFO: "Personal information",
};

export default function AdminTrustPage() {
  const [tab, setTab] = React.useState<Tab>("reviews");
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Trust & Safety</h1>
        <p className="mt-1 text-sm text-muted-foreground">Reported reviews, reports of incorrect product information, and customer questions.</p>
      </header>
      <div className="flex gap-2">
        {([
          ["reviews", "Reported reviews"],
          ["reports", "Product reports"],
          ["questions", "Customer questions"],
        ] as const).map(([key, label]) => (
          <Button key={key} size="sm" variant={tab === key ? "primary" : "outline"} onClick={() => setTab(key)}>{label}</Button>
        ))}
      </div>
      {tab === "reviews" ? <ReportedReviews /> : tab === "reports" ? <ProductReports /> : <Questions />}
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
}

function ReportedReviews() {
  const [rows, setRows] = React.useState<ReportedReview[] | null>(null);
  const load = React.useCallback(() => {
    listReportedReviews().then((r) => setRows(r.reviews)).catch(() => toast.error("Unable to load reported reviews"));
  }, []);
  React.useEffect(load, [load]);
  const act = async (id: string, action: "KEEP" | "REMOVE") => {
    try {
      await resolveReportedReview(id, action);
      toast.success(action === "KEEP" ? "Review kept and shown again" : "Review removed");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };
  if (!rows) return <Spinner />;
  if (!rows.length) return <p className="rounded-xl border border-border-soft bg-card p-8 text-center text-sm text-muted-foreground">No reported reviews. 🎉</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <article key={r.id} className="space-y-2 rounded-xl border border-border-soft bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/product/${r.product.id}`} target="_blank" className="font-medium hover:underline">{r.product.title}</Link>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.isHidden ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
              {r.isHidden ? "Hidden" : "Visible"} · {r.reports.length} report{r.reports.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} by {r.author}
            {r.verifiedPurchase ? <span className="ml-2 inline-flex items-center gap-0.5 text-emerald-700"><BadgeCheck className="h-3 w-3" /> Verified</span> : null}
          </p>
          <p>{r.text}</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {r.reports.map((x, i) => <li key={i}>• {REPORT_LABEL[x.reason] ?? x.reason}{x.details ? ` — ${x.details}` : ""}</li>)}
          </ul>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void act(r.id, "KEEP")}>Keep review</Button>
            <Button size="sm" onClick={() => void act(r.id, "REMOVE")}>Remove review</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProductReports() {
  const [status, setStatus] = React.useState<"OPEN" | "RESOLVED">("OPEN");
  const [rows, setRows] = React.useState<AdminProductReport[] | null>(null);
  const load = React.useCallback(() => {
    setRows(null);
    listProductReports(status).then((r) => setRows(r.reports)).catch(() => toast.error("Unable to load reports"));
  }, [status]);
  React.useEffect(load, [load]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={status === "OPEN" ? "secondary" : "ghost"} onClick={() => setStatus("OPEN")}>Open</Button>
        <Button size="sm" variant={status === "RESOLVED" ? "secondary" : "ghost"} onClick={() => setStatus("RESOLVED")}>Resolved</Button>
      </div>
      {!rows ? <Spinner /> : !rows.length ? (
        <p className="rounded-xl border border-border-soft bg-card p-8 text-center text-sm text-muted-foreground">No {status.toLowerCase()} reports.</p>
      ) : rows.map((r) => (
        <article key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border-soft bg-card p-4 text-sm">
          <div className="min-w-0 space-y-1">
            <Link href={`/product/${r.productId}`} target="_blank" className="font-medium hover:underline">{r.productTitle || r.productId}</Link>
            <p className="text-xs font-semibold text-amber-800">{REPORT_LABEL[r.type] ?? r.type}</p>
            {r.details ? <p className="text-muted-foreground">{r.details}</p> : null}
            <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString("en-IN")}</p>
          </div>
          {r.status === "OPEN" ? (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline"><Link href={`/admin/products?search=${encodeURIComponent(r.productId)}`}>Open in Products</Link></Button>
              <Button size="sm" onClick={() => resolveProductReport(r.id).then(() => { toast.success("Marked resolved"); load(); }).catch((e) => toast.error(e.message))}>Mark resolved</Button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Questions() {
  const [rows, setRows] = React.useState<AdminProductQuestion[] | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const load = React.useCallback(() => {
    listAdminQuestions().then((r) => setRows(r.questions)).catch(() => toast.error("Unable to load questions"));
  }, []);
  React.useEffect(load, [load]);
  if (!rows) return <Spinner />;
  if (!rows.length) return <p className="rounded-xl border border-border-soft bg-card p-8 text-center text-sm text-muted-foreground">No customer questions yet.</p>;
  return (
    <div className="space-y-3">
      {rows.map((q) => (
        <article key={q.id} className="space-y-2 rounded-xl border border-border-soft bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/product/${q.productId}`} target="_blank" className="text-xs text-muted-foreground hover:underline">{q.productTitle}</Link>
            <span className="text-xs text-muted-foreground">{new Date(q.createdAt).toLocaleDateString("en-IN")}{q.isHidden ? " · hidden" : ""}</span>
          </div>
          <p className="font-medium">Q: {q.question}</p>
          {q.answer ? (
            <p className="text-muted-foreground">A ({q.answeredBy === "ADMIN" ? "KTMONA" : "Seller"}): {q.answer}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input
                value={drafts[q.id] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                placeholder="Answer as KTMONA (the seller can also answer)"
                className="h-9 min-w-0 flex-1 rounded-md border border-border-soft bg-background px-3"
              />
              <Button size="sm" disabled={!drafts[q.id]?.trim()} onClick={() => answerAdminQuestion(q.id, drafts[q.id]!.trim()).then(() => { toast.success("Answered"); load(); }).catch((e) => toast.error(e.message))}>Answer</Button>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={() => setAdminQuestionHidden(q.id, !q.isHidden).then(load).catch((e) => toast.error(e.message))}>
            {q.isHidden ? "Show" : "Hide"}
          </Button>
        </article>
      ))}
    </div>
  );
}
