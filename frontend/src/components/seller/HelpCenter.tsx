"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, FileVideo, ImagePlus, Loader2, X } from "lucide-react";
import SupportChat from "@/components/support/support-chat";
import { createSupportTicket } from "@/services/support";
import { sellerCenter } from "@/services/seller-center";
import { useImageKitUpload } from "@/lib/use-imagekit-upload";
import { Btn, Field, Panel, errorMessage, inputCls } from "@/components/seller/kit";
import { HELP_TOPICS, findIssue, type HelpField, type HelpIssue, type HelpTopic } from "@/components/seller/help-center";
import { cn } from "@/lib/utils";

/**
 * Seller Support: Help (topics → issues → guidance → Raise a Ticket) and My
 * Tickets. State lives in the URL so the browser back button walks the steps.
 */
export function HelpCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") === "tickets" ? "tickets" : "help";
  const { topic, issue } = findIssue(params.get("topic") ?? "returns", params.get("issue"));
  const raising = params.get("raise") === "1" && issue;

  const go = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => (v === null ? q.delete(k) : q.set(k, v)));
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">Learn how to solve issues and grow on KTMONA</p>
      </div>
      <div className="flex gap-6 border-b border-border-soft text-sm font-medium">
        {(["help", "tickets"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => go({ tab: t === "help" ? null : t, raise: null })}
            className={cn("relative -mb-px pb-2.5", tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {t === "help" ? "Help" : "My Tickets"}
            {tab === t ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" /> : null}
          </button>
        ))}
      </div>

      {tab === "tickets" ? (
        <SupportChat audience="requester" title="My Tickets" description="Every ticket you have raised, with replies from the KTMONA team." />
      ) : (
        <>
          <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <button type="button" onClick={() => go({ topic: null, issue: null, raise: null })} className="hover:text-foreground">
              Help
            </button>
            {topic ? (
              <>
                <ChevronRight className="h-3 w-3" />
                <button type="button" onClick={() => go({ issue: null, raise: null })} className="hover:text-foreground">
                  {topic.title}
                </button>
              </>
            ) : null}
            {issue ? (
              <>
                <ChevronRight className="h-3 w-3" />
                <button type="button" onClick={() => go({ raise: null })} className="hover:text-foreground">
                  {issue.title}
                </button>
              </>
            ) : null}
            {raising ? (
              <>
                <ChevronRight className="h-3 w-3" /> <span>Raise a Ticket</span>
              </>
            ) : null}
          </nav>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              {raising && topic && issue ? (
                <TicketForm topic={topic} issue={issue} onDone={() => go({ tab: "tickets", topic: null, issue: null, raise: null })} />
              ) : issue && topic ? (
                <Panel title={issue.title}>
                  <div className="space-y-3 text-sm leading-relaxed text-foreground">
                    {issue.body.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                  <div className="mt-6 rounded-xl border border-border-soft bg-mist/40 p-4">
                    <p className="text-sm font-semibold">Having this issue?</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Btn variant="primary" onClick={() => go({ raise: "1" })}>
                        Raise a Ticket
                      </Btn>
                      <span className="text-xs text-muted-foreground">Expect response in {issue.responseDays ?? 2} days</span>
                    </div>
                  </div>
                </Panel>
              ) : (
                <Panel title={topic?.title ?? "Help"} padded={false}>
                  <ul className="divide-y divide-border-soft">
                    {(topic ?? HELP_TOPICS[0]!).issues.map((i) => (
                      <li key={i.id}>
                        <button type="button" onClick={() => go({ topic: (topic ?? HELP_TOPICS[0]!).id, issue: i.id, raise: null })} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm hover:bg-mist/50">
                          {i.title}
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>

            <aside className="rounded-2xl border border-border-soft bg-card p-5">
              <p className="text-sm font-semibold">Find More Help</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {issue && topic
                  ? topic.issues
                      .filter((i) => i.id !== issue.id)
                      .map((i) => (
                        <li key={i.id}>
                          <button type="button" onClick={() => go({ issue: i.id, raise: null })} className="text-left text-muted-foreground hover:text-foreground">
                            {i.title}
                          </button>
                        </li>
                      ))
                  : HELP_TOPICS.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => go({ topic: t.id, issue: null, raise: null })}
                          className={cn("text-left hover:text-foreground", t.id === topic?.id ? "font-semibold text-foreground" : "text-muted-foreground")}
                        >
                          {t.title}
                        </button>
                      </li>
                    ))}
              </ul>
              <div className="mt-5 border-t border-border-soft pt-4 text-xs text-muted-foreground">
                Looking for an old conversation?{" "}
                <Link href="/seller/support?tab=tickets" className="font-semibold text-ink hover:underline dark:text-brand">
                  My Tickets
                </Link>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function UploadSlot({ field, value, onChange }: { field: HelpField; value: string[]; onChange: (urls: string[]) => void }) {
  const { upload, uploading } = useImageKitUpload("/seller-support");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const accept = field.type === "video" ? "video/*" : field.type === "image" ? "image/*" : "image/*,video/*,application/pdf";
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 3)) urls.push(await upload(f));
      onChange([...value, ...urls].slice(0, 3));
    } catch (err) {
      toast.error(errorMessage(err, "Upload failed"));
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">
        {field.label}
        {field.required ? <span className="text-red-600"> *</span> : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <span key={url} className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border-soft bg-mist">
            {field.type === "video" ? (
              <FileVideo className="h-6 w-6 text-muted-foreground" />
            ) : (
              <img src={url} alt="" className="h-full w-full object-cover" />
            )}
            <button type="button" onClick={() => onChange(value.filter((u) => u !== url))} className="absolute right-1 top-1 rounded-full bg-ink/70 p-0.5 text-white" aria-label="Remove">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-xs text-muted-foreground hover:border-brand hover:text-foreground"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          Upload
        </button>
        <input ref={inputRef} type="file" accept={accept} multiple hidden onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} />
      </div>
      {"hint" in field && field.hint ? <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p> : null}
    </div>
  );
}

function TicketForm({ topic, issue, onDone }: { topic: HelpTopic; issue: HelpIssue; onDone: () => void }) {
  const fields = issue.fields ?? [];
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [files, setFiles] = React.useState<Record<string, string[]>>({});
  const [description, setDescription] = React.useState("");
  const [attachments, setAttachments] = React.useState<string[]>([]);
  const [phone, setPhone] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of fields) {
      if (!f.required) continue;
      const isFile = f.type === "image" || f.type === "video" || f.type === "file";
      if (isFile ? !(files[f.key]?.length) : !values[f.key]?.trim()) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    if (description.trim().length < 10) {
      toast.error("Describe the issue in at least 10 characters");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      toast.error("Enter a valid 10-digit callback number");
      return;
    }
    setSaving(true);
    try {
      const lines = [
        `Issue: ${issue.title}`,
        ...fields.filter((f) => f.type !== "image" && f.type !== "video" && f.type !== "file").map((f) => `${f.label}: ${values[f.key]?.trim() || "-"}`),
        `Callback number: ${phone.trim()}`,
        "",
        description.trim(),
      ];
      const allFiles = [...fields.flatMap((f) => files[f.key] ?? []), ...attachments];
      const fileLines = fields
        .filter((f) => files[f.key]?.length)
        .map((f) => `${f.label}: ${files[f.key]!.join(" ")}`);
      const message = [...lines, ...(fileLines.length ? ["", ...fileLines] : [])].join("\n").slice(0, 4000);
      const orderRef = values.orderId?.trim().replace(/^#/, "") || null;
      await createSupportTicket({
        subject: issue.title.slice(0, 200),
        category: topic.category,
        orderId: orderRef,
        message,
        attachments: allFiles.slice(0, 5),
      });
      let claimNote = "";
      if (issue.claimType && orderRef) {
        try {
          const claim = await sellerCenter.createClaim({
            orderId: orderRef,
            type: issue.claimType,
            description: `${issue.title}. ${description.trim()}`.slice(0, 2000),
            images: allFiles.filter((u) => !/\.(mp4|mov|webm|m4v)$/i.test(u)).slice(0, 6),
          });
          claimNote = ` Claim ${claim.claimNumber} filed.`;
        } catch (err) {
          claimNote = ` (Claim not filed: ${errorMessage(err)})`;
        }
      }
      toast.success(`Ticket raised.${claimNote}`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Could not raise the ticket"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Raise a Ticket">
      <form onSubmit={submit} className="max-w-lg space-y-4">
        <Field label="Issue">
          <input className={inputCls} value={issue.title} readOnly />
        </Field>
        {fields.map((f) =>
          f.type === "image" || f.type === "video" || f.type === "file" ? (
            <UploadSlot key={f.key} field={f} value={files[f.key] ?? []} onChange={(urls) => setFiles((p) => ({ ...p, [f.key]: urls }))} />
          ) : f.type === "select" ? (
            <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
              <select className={inputCls} value={values[f.key] ?? ""} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}>
                <option value="">Select</option>
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`} hint={"hint" in f ? f.hint : undefined}>
              <input
                className={inputCls}
                value={values[f.key] ?? ""}
                placeholder={"placeholder" in f ? f.placeholder : undefined}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </Field>
          )
        )}
        <Field label="Description *" hint={`${description.length}/1000`}>
          <textarea className={cn(inputCls, "h-28 py-2")} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <UploadSlot field={{ key: "attachments", label: "Attachments", type: "file" }} value={attachments} onChange={setAttachments} />
        <Field label="Callback Number *">
          <input className={inputCls} inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <div className="flex gap-2">
          <Btn type="submit" variant="primary" loading={saving}>
            Submit
          </Btn>
          <Btn variant="outline" onClick={() => history.back()}>
            Cancel
          </Btn>
        </div>
      </form>
    </Panel>
  );
}
