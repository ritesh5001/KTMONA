"use client";

/**
 * Product page extras: available offers, "Notify me" for sold-out sizes,
 * Questions & answers, and "Report incorrect information".
 */

import * as React from "react";
import Link from "next/link";
import { Bell, BellRing, Flag, MessageCircleQuestion, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { hasSession } from "@/lib/session";
import { loginUrlWithReturn } from "@/lib/login-redirect";
import { couponHeadline, getProductOffers, type PublicCoupon } from "@/services/offers";
import { cancelBackInStock, notifyBackInStock } from "@/services/account";
import {
  askProductQuestion,
  fetchProductQuestions,
  PRODUCT_REPORT_TYPES,
  reportProductInfo,
  type ProductQuestion,
} from "@/services/reviews";

/** "Available offers" under the price. */
export function ProductOffers({ productId }: { productId: string }) {
  const [data, setData] = React.useState<{ coupons: PublicCoupon[]; welcome: { amount: number; minOrder: number } | null; cashbackPercent: number } | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    getProductOffers(productId).then(setData).catch(() => setData(null));
  }, [productId]);

  if (!data) return null;
  const lines: Array<{ key: string; text: React.ReactNode }> = [];
  for (const c of data.coupons) {
    lines.push({
      key: c.code,
      text: (
        <>
          <strong>{couponHeadline(c)}</strong>
          {c.minOrderAmount > 0 ? ` on orders of ₹${c.minOrderAmount}+` : ""} ·{" "}
          {c.autoApply ? "applied automatically" : <>code <span className="font-mono font-semibold">{c.code}</span></>}
        </>
      ),
    });
  }
  if (data.welcome) {
    lines.push({ key: "welcome", text: <><strong>₹{data.welcome.amount} off</strong> your first KTMONA order of ₹{data.welcome.minOrder}+ · applied automatically</> });
  }
  if (data.cashbackPercent > 0) {
    lines.push({ key: "cashback", text: <><strong>{data.cashbackPercent}% cashback</strong> to your KTMONA wallet after delivery</> });
  }
  if (!lines.length) return null;
  const shown = expanded ? lines : lines.slice(0, 3);

  return (
    <section aria-label="Available offers" className="space-y-2 rounded-xl border border-border-soft bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Available offers</p>
      <ul className="space-y-1.5 text-sm">
        {shown.map((l) => (
          <li key={l.key} className="flex gap-2">
            <Tag className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-4 text-xs">
        {lines.length > 3 ? (
          <button type="button" className="font-medium text-brand-strong hover:underline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : `+${lines.length - 3} more offers`}
          </button>
        ) : null}
        <Link href="/offers" className="text-muted-foreground hover:underline">Terms apply</Link>
      </div>
    </section>
  );
}

/** "Notify me" for sizes that are sold out. */
export function BackInStockPrompt({
  productId,
  soldOut,
  allSoldOut,
}: {
  productId: string;
  soldOut: Array<{ id: string; label: string }>;
  allSoldOut: boolean;
}) {
  const [variantId, setVariantId] = React.useState<string>(soldOut[0]?.id ?? "");
  const [subscribed, setSubscribed] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (soldOut.length && !soldOut.some((s) => s.id === variantId)) setVariantId(soldOut[0]!.id);
  }, [soldOut, variantId]);

  if (!soldOut.length) return null;

  const toggle = async () => {
    if (!hasSession()) {
      toast.info("Sign in to get a back-in-stock alert.");
      window.location.href = loginUrlWithReturn();
      return;
    }
    setBusy(true);
    try {
      if (subscribed.has(variantId)) {
        await cancelBackInStock(productId, variantId);
        setSubscribed((s) => { const n = new Set(s); n.delete(variantId); return n; });
        toast.success("Alert removed");
      } else {
        await notifyBackInStock(productId, variantId);
        setSubscribed((s) => new Set(s).add(variantId));
        toast.success("We'll let you know as soon as it's back in stock.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set the alert");
    } finally {
      setBusy(false);
    }
  };

  const on = subscribed.has(variantId);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border-soft p-3 text-sm">
      <span className="text-muted-foreground">{allSoldOut ? "Sold out." : "Size sold out?"}</span>
      {soldOut.length > 1 ? (
        <select
          aria-label="Size to be notified about"
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {soldOut.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      ) : (
        <span className="font-medium">{soldOut[0]!.label}</span>
      )}
      <Button size="sm" variant={on ? "secondary" : "outline"} disabled={busy} onClick={() => void toggle()}>
        {on ? <BellRing className="mr-1.5 h-4 w-4" /> : <Bell className="mr-1.5 h-4 w-4" />}
        {on ? "Alert on" : "Notify me"}
      </Button>
    </div>
  );
}

/** Questions & answers, and the "report incorrect information" form. */
export function ProductQuestionsAndReport({ productId }: { productId: string }) {
  const [questions, setQuestions] = React.useState<ProductQuestion[]>([]);
  const [asking, setAsking] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [reporting, setReporting] = React.useState(false);
  const [reportType, setReportType] = React.useState<string>(PRODUCT_REPORT_TYPES[0].value);
  const [reportDetails, setReportDetails] = React.useState("");

  React.useEffect(() => {
    fetchProductQuestions(productId).then((r) => setQuestions(r.questions)).catch(() => undefined);
  }, [productId]);

  const needSignIn = () => {
    if (hasSession()) return false;
    toast.info("Please sign in first.");
    window.location.href = loginUrlWithReturn();
    return true;
  };

  const ask = async () => {
    if (needSignIn()) return;
    if (question.trim().length < 10) return toast.error("Please write at least 10 characters.");
    setSending(true);
    try {
      await askProductQuestion(productId, question.trim());
      toast.success("Question sent. We'll notify you when the seller answers.");
      setQuestion("");
      setAsking(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your question");
    } finally {
      setSending(false);
    }
  };

  const report = async () => {
    if (needSignIn()) return;
    setSending(true);
    try {
      const r = await reportProductInfo(productId, reportType, reportDetails);
      toast.success(r.alreadyReported ? "You already reported this product — we're on it." : "Thanks for letting us know. Our team will check this listing.");
      setReporting(false);
      setReportDetails("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the report");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="space-y-6" id="questions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-serif text-2xl font-light text-foreground">
          <MessageCircleQuestion className="h-6 w-6 text-brand-strong" /> Questions & Answers
        </h3>
        {!asking ? <Button variant="outline" onClick={() => setAsking(true)}>Ask a question</Button> : null}
      </div>

      {asking ? (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="e.g. Is the fabric see-through? What is the length?" className="min-h-20" />
          <p className="text-xs text-muted-foreground">The seller answers questions; answers appear here for everyone. Please don&apos;t share phone numbers or addresses.</p>
          <div className="flex gap-2">
            <Button onClick={() => void ask()} disabled={sending}>{sending ? "Sending…" : "Submit question"}</Button>
            <Button variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {questions.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">No questions answered yet.</p>
      ) : (
        <ul className="space-y-4">
          {questions.map((q) => (
            <li key={q.id} className="border-b pb-4 last:border-0">
              <p className="text-sm font-medium">Q: {q.question}</p>
              <p className="mt-1 text-sm text-muted-foreground">A: {q.answer}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Answered by {q.answeredBy}
                {q.answeredAt ? ` · ${new Date(q.answeredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-border-soft p-4 text-sm">
        {!reporting ? (
          <button type="button" onClick={() => setReporting(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Flag className="h-4 w-4" /> Report incorrect product information
          </button>
        ) : (
          <div className="space-y-3">
            <p className="font-medium">What&apos;s wrong with this listing?</p>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm sm:w-auto" aria-label="Problem type">
              {PRODUCT_REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <Textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} maxLength={1000} placeholder="Tell us what is incorrect (optional)" className="min-h-16" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void report()} disabled={sending}>Send report</Button>
              <Button size="sm" variant="ghost" onClick={() => setReporting(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
