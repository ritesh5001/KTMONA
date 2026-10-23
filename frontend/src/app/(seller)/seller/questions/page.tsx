"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { answerSellerQuestion, listSellerQuestions, type AdminProductQuestion } from "@/services/admin-trust";

/** Seller panel → Customer Questions: answer what shoppers ask on product pages. */
export default function SellerQuestionsPage() {
  const [showAll, setShowAll] = React.useState(false);
  const [rows, setRows] = React.useState<AdminProductQuestion[] | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setRows(null);
    listSellerQuestions(showAll).then((r) => setRows(r.questions)).catch(() => toast.error("Unable to load questions"));
  }, [showAll]);
  React.useEffect(load, [load]);

  const answer = async (id: string) => {
    const text = drafts[id]?.trim();
    if (!text) return;
    setSaving(id);
    try {
      await answerSellerQuestion(id, text);
      toast.success("Answer published on the product page");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the answer");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><MessageCircleQuestion className="h-5 w-5" /> Customer Questions</h1>
          <p className="text-sm text-muted-foreground">Answers appear on your product page for every shopper. Quick, accurate answers win orders.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={!showAll ? "primary" : "outline"} onClick={() => setShowAll(false)}>Unanswered</Button>
          <Button size="sm" variant={showAll ? "primary" : "outline"} onClick={() => setShowAll(true)}>All</Button>
        </div>
      </header>

      {!rows ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{showAll ? "No questions yet." : "All questions answered. 👍"}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((q) => (
            <li key={q.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <Link href={`/product/${q.productId}`} target="_blank" className="hover:underline">{q.productTitle}</Link>
                <span>{new Date(q.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              </div>
              <p className="font-medium">Q: {q.question}</p>
              {q.answer ? (
                <p className="text-muted-foreground">A: {q.answer}</p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <textarea
                    value={drafts[q.id] ?? ""}
                    onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                    rows={2}
                    maxLength={1000}
                    placeholder="Write a clear, honest answer (no phone numbers or links)"
                    className="min-w-0 flex-1 rounded-md border border-input bg-background p-2"
                  />
                  <Button size="sm" disabled={!drafts[q.id]?.trim() || saving === q.id} onClick={() => void answer(q.id)}>
                    {saving === q.id ? "Saving…" : "Publish answer"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
