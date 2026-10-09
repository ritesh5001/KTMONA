"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Briefcase, Plus, UserRoundSearch } from "lucide-react";
import { fmtDate } from "@/services/seller-center";
import { JOB_TYPE_LABEL, siteApi, type JobInput, type JobOpening, type JobType } from "@/services/platform";
import {
  Badge,
  Btn,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  PageShell,
  Pager,
  Table,
  Tabs,
  Td,
  Th,
  errorMessage,
  inputCls,
} from "@/components/seller/kit";
import { cn } from "@/lib/utils";

type Tab = "openings" | "applications";
const APPLICATION_STATUSES = ["NEW", "REVIEWED", "SHORTLISTED", "REJECTED", "HIRED"] as const;
const STATUS_TONE: Record<string, "blue" | "gray" | "green" | "orange"> = {
  NEW: "orange",
  REVIEWED: "gray",
  SHORTLISTED: "blue",
  REJECTED: "gray",
  HIRED: "green",
};

export default function AdminCareersPage() {
  const [tab, setTab] = React.useState<Tab>("openings");
  return (
    <PageShell>
      <PageHeader
        title="Careers"
        description="Job openings shown on the Careers page of the store and the seller panel, and the applications people send."
      />
      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs
            tabs={[
              { key: "openings", label: "Job openings" },
              { key: "applications", label: "Applications" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        {tab === "openings" ? <Openings /> : <Applications />}
      </div>
    </PageShell>
  );
}

function Openings() {
  const { data, error, isLoading, mutate } = useSWR("admin-jobs", siteApi.admin.jobs);
  const [editing, setEditing] = React.useState<JobOpening | "new" | null>(null);

  const toggle = async (job: JobOpening) => {
    try {
      await siteApi.admin.updateJob(job.id, { isActive: !job.isActive });
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (job: JobOpening) => {
    if (!window.confirm(`Delete "${job.title}"? Its applications are kept.`)) return;
    try {
      await siteApi.admin.deleteJob(job.id);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="flex justify-end p-4">
        <Btn variant="brand" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New opening</Btn>
      </div>
      {error && !data ? (
        <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
      ) : isLoading && !data ? (
        <Loading />
      ) : !data || data.jobs.length === 0 ? (
        <Empty icon={Briefcase} title="No openings yet" text="When there are no openings, the Careers page still invites people to send their CV." />
      ) : (
        <ul className="divide-y divide-border-soft border-t border-border-soft">
          {data.jobs.map((job) => (
            <li key={job.id} className={cn("flex flex-col gap-3 p-5 sm:flex-row sm:items-start", !job.isActive && "opacity-60")}>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{job.title}</h2>
                  <Badge tone="blue">{JOB_TYPE_LABEL[job.type]}</Badge>
                  {!job.isActive ? <Badge tone="gray">Closed</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[job.department, job.location].filter(Boolean).join(" · ") || "—"} · Posted {fmtDate(job.createdAt)} · {job.applications ?? 0} application{job.applications === 1 ? "" : "s"}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
              </div>
              <div className="flex gap-2">
                <Btn size="sm" variant="outline" onClick={() => setEditing(job)}>Edit</Btn>
                <Btn size="sm" variant="ghost" onClick={() => toggle(job)}>{job.isActive ? "Close" : "Reopen"}</Btn>
                <Btn size="sm" variant="danger" onClick={() => remove(job)}>Delete</Btn>
              </div>
            </li>
          ))}
        </ul>
      )}
      <JobModal job={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />
    </>
  );
}

function JobModal({ job, onClose, onSaved }: { job: JobOpening | "new" | null; onClose: () => void; onSaved: () => void }) {
  const existing = job && job !== "new" ? job : null;
  const [f, setF] = React.useState<JobInput>({ title: "", department: "", location: "", type: "FULL_TIME", description: "", isActive: true });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (!job) return;
    setF({
      title: existing?.title ?? "",
      department: existing?.department ?? "",
      location: existing?.location ?? "",
      type: existing?.type ?? "FULL_TIME",
      description: existing?.description ?? "",
      isActive: existing?.isActive ?? true,
    });
  }, [job]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!job) return null;
  const submit = async () => {
    setSaving(true);
    try {
      if (existing) await siteApi.admin.updateJob(existing.id, f);
      else await siteApi.admin.createJob(f);
      toast.success("Opening saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={existing ? "Edit opening" : "New opening"}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="brand" loading={saving} disabled={f.title.trim().length < 2 || f.description.trim().length < 10} onClick={submit}>Save</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Job title"><input className={inputCls} value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Seller Success Executive" /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Department"><input className={inputCls} value={f.department ?? ""} onChange={(e) => setF((p) => ({ ...p, department: e.target.value }))} placeholder="Operations" /></Field>
          <Field label="Location"><input className={inputCls} value={f.location ?? ""} onChange={(e) => setF((p) => ({ ...p, location: e.target.value }))} placeholder="Faridabad / Remote" /></Field>
          <Field label="Type">
            <select className={inputCls} value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value as JobType }))}>
              {Object.entries(JOB_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description" hint="Responsibilities, requirements, salary range — line breaks are kept.">
          <textarea rows={8} className={`${inputCls} h-auto py-2`} value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF((p) => ({ ...p, isActive: e.target.checked }))} />
          Show on the Careers page
        </label>
      </div>
    </Modal>
  );
}

function Applications() {
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status]);
  const { data, error, isLoading, mutate } = useSWR(["admin-applications", status, page], () => siteApi.admin.applications({ status, page }));

  const setAppStatus = async (id: string, next: string) => {
    try {
      await siteApi.admin.setApplicationStatus(id, next);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="flex justify-end p-4">
        <select className={`${inputCls} sm:w-56`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All applications</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </div>
      {error && !data ? (
        <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
      ) : isLoading && !data ? (
        <Loading />
      ) : !data || data.applications.length === 0 ? (
        <Empty icon={UserRoundSearch} title="No applications yet" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Applicant</Th>
                <Th>Role</Th>
                <Th>From</Th>
                <Th>Received</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.applications.map((a) => (
                <tr key={a.id} className="align-top">
                  <Td>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <a className="hover:underline" href={`mailto:${a.email}`}>{a.email}</a>
                      {a.phone ? ` · ${a.phone}` : ""}
                    </p>
                    {a.resumeUrl ? (
                      <a className="text-xs font-medium text-brand-strong hover:underline" href={a.resumeUrl} target="_blank" rel="noopener noreferrer">Open CV</a>
                    ) : null}
                    {a.message ? <p className="mt-1 max-w-md whitespace-pre-line text-xs text-muted-foreground">{a.message}</p> : null}
                  </Td>
                  <Td className="text-sm">{a.job?.title ?? "General application"}</Td>
                  <Td><Badge tone={a.source === "seller" ? "orange" : "blue"}>{a.source === "seller" ? "Seller panel" : "Store"}</Badge></Td>
                  <Td className="whitespace-nowrap text-xs">{fmtDate(a.createdAt, true)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[a.status] ?? "gray"}>{a.status.toLowerCase()}</Badge>
                      <select className={`${inputCls} h-8 w-32 text-xs`} value={a.status} onChange={(e) => setAppStatus(a.id, e.target.value)} aria-label="Change status">
                        {APPLICATION_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={setPage} />
        </>
      )}
    </>
  );
}
