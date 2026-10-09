"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, ShieldCheck, Users } from "lucide-react";
import { fmtDate } from "@/services/seller-center";
import {
  staffApi,
  type Employee,
  type StaffPermission,
  type StaffPermissionInfo,
} from "@/services/platform";
import { Badge, Btn, Empty, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, errorMessage, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

export default function EmployeesPage() {
  const access = useSWR("admin-my-access", staffApi.myAccess);
  const { data, error, isLoading, mutate } = useSWR(access.data?.canManageEmployees ? "admin-employees" : null, staffApi.employees);
  const perms = useSWR(access.data?.canManageEmployees ? "admin-staff-permissions" : null, staffApi.permissions);
  const [editing, setEditing] = React.useState<Employee | "new" | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const labels = React.useMemo(
    () => Object.fromEntries((perms.data?.permissions ?? []).map((p) => [p.key, p.label])) as Record<StaffPermission, string>,
    [perms.data]
  );

  const toggleStatus = async (e: Employee) => {
    const next = e.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (next === "SUSPENDED" && !window.confirm(`Deactivate ${e.name}? They will be signed out and cannot log in until reactivated.`)) return;
    setBusy(e.id);
    try {
      await staffApi.updateEmployee(e.id, { status: next });
      toast.success(next === "ACTIVE" ? "Employee reactivated" : "Employee deactivated");
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (access.data && !access.data.canManageEmployees) {
    return (
      <PageShell>
        <PageHeader title="Employees" />
        <Empty icon={ShieldCheck} title="Only admins can manage employees" text="Ask an admin if you need access to another section." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Employees"
        description="Create separate logins for your team and choose exactly which sections of the admin panel each person can use. Every change they make is recorded in the Activity Log."
        actions={<Btn variant="brand" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add employee</Btn>}
      />
      <div className="rounded-2xl border border-border-soft bg-card">
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : (isLoading || access.isLoading) && !data ? (
          <Loading />
        ) : !data || data.employees.length === 0 ? (
          <Empty icon={Users} title="No employees yet" text="Add your first team member and give them access to the sections they work on." />
        ) : (
          <ul className="divide-y divide-border-soft">
            {data.employees.map((e) => (
              <li key={e.id} className={cn("flex flex-col gap-3 p-5 lg:flex-row lg:items-start", e.status !== "ACTIVE" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">{e.name}</h2>
                    {e.designation ? <span className="text-xs text-muted-foreground">· {e.designation}</span> : null}
                    <Badge tone={e.status === "ACTIVE" ? "green" : "gray"}>{e.status === "ACTIVE" ? "Active" : "Deactivated"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.email}
                    {e.phone ? ` · ${e.phone}` : ""} · Added {fmtDate(e.createdAt)}
                    {e.lastActiveAt ? ` · Last active ${fmtDate(e.lastActiveAt, true)}` : " · Never signed in"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.permissions.map((p) => (
                      <Badge key={p} tone="blue">{labels[p] ?? p}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Btn size="sm" variant="outline" onClick={() => setEditing(e)}>Edit access</Btn>
                  <Btn size="sm" variant={e.status === "ACTIVE" ? "danger" : "ghost"} loading={busy === e.id} onClick={() => toggleStatus(e)}>
                    {e.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <EmployeeModal
        employee={editing}
        permissions={perms.data?.permissions ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => mutate()}
      />
    </PageShell>
  );
}

function EmployeeModal({
  employee,
  permissions,
  onClose,
  onSaved,
}: {
  employee: Employee | "new" | null;
  permissions: StaffPermissionInfo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = employee && employee !== "new" ? employee : null;
  const [f, setF] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    designation: "",
    password: "",
    permissions: [] as StaffPermission[],
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!employee) return;
    setShowPassword(false);
    setF({
      firstName: existing?.firstName ?? "",
      lastName: existing?.lastName ?? "",
      email: existing?.email ?? "",
      phone: existing?.phone ?? "",
      designation: existing?.designation ?? "",
      password: "",
      permissions: existing?.permissions ?? [],
    });
  }, [employee]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!employee) return null;

  const togglePermission = (key: StaffPermission) =>
    setF((p) => ({
      ...p,
      permissions: p.permissions.includes(key) ? p.permissions.filter((k) => k !== key) : [...p.permissions, key],
    }));

  const submit = async () => {
    setSaving(true);
    try {
      if (existing) {
        await staffApi.updateEmployee(existing.id, {
          firstName: f.firstName,
          lastName: f.lastName,
          designation: f.designation || null,
          permissions: f.permissions,
          ...(f.password ? { password: f.password } : {}),
        });
        toast.success("Employee updated");
      } else {
        await staffApi.createEmployee({
          firstName: f.firstName,
          lastName: f.lastName,
          email: f.email,
          ...(f.phone ? { phone: f.phone.replace(/\D/g, "") } : {}),
          ...(f.designation ? { designation: f.designation } : {}),
          password: f.password,
          permissions: f.permissions,
        });
        toast.success("Employee added. Share the email and password with them to sign in at the admin login.");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    f.firstName.trim().length > 0 &&
    f.permissions.length > 0 &&
    (existing ? true : /\S+@\S+\.\S+/.test(f.email) && f.password.length >= 8);

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={existing ? `Edit ${existing.name}` : "Add employee"}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="brand" loading={saving} disabled={!canSave} onClick={submit}>{existing ? "Save changes" : "Create login"}</Btn>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><input className={inputCls} value={f.firstName} onChange={(e) => setF((p) => ({ ...p, firstName: e.target.value }))} /></Field>
          <Field label="Last name"><input className={inputCls} value={f.lastName} onChange={(e) => setF((p) => ({ ...p, lastName: e.target.value }))} /></Field>
          <Field label="Login email" hint={existing ? "The login email cannot be changed." : undefined}>
            <input className={inputCls} type="email" autoComplete="off" disabled={Boolean(existing)} value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} />
          </Field>
          <Field label="Mobile (optional)">
            <input className={inputCls} inputMode="numeric" autoComplete="off" disabled={Boolean(existing)} value={f.phone} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "") }))} />
          </Field>
          <Field label="Designation (optional)"><input className={inputCls} value={f.designation} placeholder="e.g. Catalog executive" onChange={(e) => setF((p) => ({ ...p, designation: e.target.value }))} /></Field>
          <Field label={existing ? "New password (optional)" : "Password"} hint="At least 8 characters, 1 uppercase letter and 1 number.">
            <div className="relative">
              <input
                className={inputCls}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={f.password}
                onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Sections this employee can use</p>
            <button
              type="button"
              className="text-xs font-medium text-brand-strong hover:underline"
              onClick={() =>
                setF((p) => ({ ...p, permissions: p.permissions.length === permissions.length ? [] : permissions.map((x) => x.key) }))
              }
            >
              {f.permissions.length === permissions.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {permissions.map((p) => {
              const on = f.permissions.includes(p.key);
              return (
                <label
                  key={p.key}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                    on ? "border-brand bg-brand/5" : "border-border-soft hover:bg-mist"
                  )}
                >
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand,#FF8A00)]" checked={on} onChange={() => togglePermission(p.key)} />
                  <span>
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{p.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Employees never see Employees management. Changes to their sections apply within a minute.
          </p>
        </div>
      </div>
    </Modal>
  );
}
