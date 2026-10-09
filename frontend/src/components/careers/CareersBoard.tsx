"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Briefcase, Clock, MapPin, Send } from "lucide-react";
import { JOB_TYPE_LABEL, siteApi, type JobOpening } from "@/services/platform";
import { Btn, Field, Modal, inputCls } from "@/components/seller/kit";
import { getSessionUser } from "@/lib/session";

/**
 * Open positions with an apply form. Used by the storefront Careers page and
 * the seller panel's Careers page (`source` records where it was sent from).
 */
export function CareersBoard({ source }: { source: "customer" | "seller" }) {
  const { data, error, isLoading, mutate } = useSWR("site-careers", siteApi.jobs);
  const [applyFor, setApplyFor] = React.useState<JobOpening | "general" | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const jobs = data?.jobs ?? [];

  return (
    <div className="space-y-4">
      {error && !data ? (
        <div className="rounded-2xl border border-border-soft bg-card p-6 text-sm">
          Couldn&apos;t load openings.{" "}
          <button type="button" className="font-medium text-brand-strong hover:underline" onClick={() => mutate()}>Try again</button>
        </div>
      ) : isLoading && !data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-mist" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-soft bg-card p-8 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No open positions right now</p>
          <p className="mt-1 text-sm text-muted-foreground">We are always happy to meet good people. Send us your CV and we&apos;ll reach out when a role fits.</p>
        </div>
      ) : (
        jobs.map((job) => {
          const open = expanded === job.id;
          return (
            <article key={job.id} className="rounded-2xl border border-border-soft bg-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">{job.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {job.department ? <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{job.department}</span> : null}
                    {job.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span> : null}
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{JOB_TYPE_LABEL[job.type] ?? job.type}</span>
                  </div>
                </div>
                <Btn variant="brand" size="sm" onClick={() => setApplyFor(job)}>Apply now</Btn>
              </div>
              <p className={`mt-3 whitespace-pre-line text-sm text-muted-foreground ${open ? "" : "line-clamp-3"}`}>{job.description}</p>
              {job.description.length > 220 ? (
                <button type="button" className="mt-1 text-sm font-medium text-brand-strong hover:underline" onClick={() => setExpanded(open ? null : job.id)}>
                  {open ? "Show less" : "Read more"}
                </button>
              ) : null}
            </article>
          );
        })
      )}

      <div className="flex flex-col items-start gap-3 rounded-2xl bg-ink p-5 text-paper sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Don&apos;t see the right role?</p>
          <p className="text-sm text-paper/75">Send a general application and we&apos;ll keep you in mind.</p>
        </div>
        <Btn variant="brand" onClick={() => setApplyFor("general")}><Send className="h-4 w-4" /> Send your CV</Btn>
      </div>

      <ApplyModal target={applyFor} source={source} onClose={() => setApplyFor(null)} />
    </div>
  );
}

function ApplyModal({ target, source, onClose }: { target: JobOpening | "general" | null; source: "customer" | "seller"; onClose: () => void }) {
  const [f, setF] = React.useState({ name: "", email: "", phone: "", resumeUrl: "", message: "" });
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!target) return;
    const user = getSessionUser<{ email?: string | null; phone?: string | null }>();
    setF({ name: "", email: user?.email ?? "", phone: user?.phone ?? "", resumeUrl: "", message: "" });
  }, [target]);

  if (!target) return null;
  const job = target === "general" ? null : target;

  const submit = async () => {
    setSending(true);
    try {
      const res = await siteApi.apply({
        jobId: job?.id ?? null,
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim() || null,
        resumeUrl: f.resumeUrl.trim() || null,
        message: f.message.trim() || null,
        source,
      });
      toast.success(res.message);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your application");
    } finally {
      setSending(false);
    }
  };

  const valid = f.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.email);

  return (
    <Modal
      open
      onClose={onClose}
      title={job ? `Apply: ${job.title}` : "General application"}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="brand" loading={sending} disabled={!valid} onClick={submit}>Send application</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name"><input className={inputCls} value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} /></Field>
          <Field label="Mobile (optional)"><input className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} /></Field>
        </div>
        <Field label="Link to your CV (optional)" hint="Google Drive, Dropbox or LinkedIn link — make sure it is viewable by anyone with the link.">
          <input className={inputCls} type="url" placeholder="https://" value={f.resumeUrl} onChange={(e) => setF((p) => ({ ...p, resumeUrl: e.target.value }))} />
        </Field>
        <Field label="Why you'd be a great fit (optional)">
          <textarea rows={4} className={`${inputCls} h-auto py-2`} value={f.message} onChange={(e) => setF((p) => ({ ...p, message: e.target.value }))} />
        </Field>
      </div>
    </Modal>
  );
}
