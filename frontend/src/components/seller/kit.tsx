"use client";

/* Small UI kit shared by the seller panel pages (KTMONA panel style). */

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb ? (
          <Link href={breadcrumb.href} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" />
            {breadcrumb.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ children, className, title, action, padded = true }: { children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode; padded?: boolean }) {
  return (
    <section className={cn("rounded-2xl border border-border-soft bg-card", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

const TONES = {
  orange: "bg-brand/12 text-brand-strong",
  navy: "bg-ink/8 text-ink dark:bg-white/10 dark:text-white",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  red: "bg-red-500/10 text-red-700 dark:text-red-300",
  amber: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
} as const;
export type Tone = keyof typeof TONES;

export function IconChip({ icon: Icon, tone = "orange", className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", TONES[tone], className)}>
      <Icon className="h-5 w-5" strokeWidth={1.8} />
    </span>
  );
}

export function StatCard({
  icon,
  tone = "orange",
  label,
  value,
  sub,
  change,
  href,
}: {
  icon: LucideIcon;
  tone?: Tone;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  change?: number | null;
  href?: string;
}) {
  const body = (
    <div className="flex h-full items-start gap-4 rounded-2xl border border-border-soft bg-card p-5 transition-colors hover:border-brand/40">
      <IconChip icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {change !== undefined ? <Change value={change} /> : null}
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Change({ value, suffix = "vs. previous period" }: { value: number | null; suffix?: string }) {
  if (value === null) return <p className="mt-1 text-xs text-muted-foreground">New</p>;
  const up = value >= 0;
  return (
    <p className="mt-1 text-xs">
      <span className={cn("font-semibold", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
        {up ? "↑" : "↓"} {Math.abs(value)}%
      </span>{" "}
      <span className="text-muted-foreground">{suffix}</span>
    </p>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  counts,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  counts?: Partial<Record<string, number>>;
}) {
  return (
    <div className="scrollbar-hide -mx-1 flex gap-1 overflow-x-auto border-b border-border-soft px-1">
      {tabs.map((t) => {
        const active = t.key === value;
        const count = counts?.[t.key];
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {count !== undefined ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", active ? "bg-brand text-ink" : "bg-mist text-muted-foreground")}>
                {count}
              </span>
            ) : null}
            {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" /> : null}
          </button>
        );
      })}
    </div>
  );
}

const BADGE: Record<string, string> = {
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  orange: "bg-brand/12 text-brand-strong",
  red: "bg-red-500/10 text-red-700 dark:text-red-300",
  gray: "bg-mist text-muted-foreground",
  navy: "bg-ink text-paper dark:bg-white/15",
};

export function Badge({ tone = "gray", children, className }: { tone?: keyof typeof BADGE; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold", BADGE[tone], className)}>{children}</span>;
}

/** Map any seller-center status string to a badge. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [keyof typeof BADGE, string]> = {
    PENDING: ["orange", "Pending"],
    READY_TO_SHIP: ["blue", "Ready to ship"],
    CREATED: ["blue", "Ready to ship"],
    SHIPPED: ["blue", "Shipped"],
    DELIVERED: ["green", "Delivered"],
    CANCELLED: ["red", "Cancelled"],
    RTO_INITIATED: ["orange", "RTO in transit"],
    RTO_DELIVERED: ["gray", "RTO received"],
    LIVE: ["green", "Live"],
    UNDER_REVIEW: ["orange", "Under review"],
    REJECTED: ["red", "Rejected"],
    REMOVED: ["red", "Removed by admin"],
    PAUSED: ["gray", "Paused"],
    PAUSED_HOLIDAY: ["gray", "Paused (holiday)"],
    APPROVED: ["green", "Approved"],
    REQUESTED: ["orange", "Requested"],
    INSPECTING: ["blue", "Inspecting"],
    REFUNDED: ["green", "Refunded"],
    OPEN: ["orange", "Open"],
    ACTIVE: ["green", "Active"],
    SCHEDULED: ["blue", "Scheduled"],
    ENDED: ["gray", "Ended"],
    upcoming: ["blue", "Upcoming"],
    outstanding: ["orange", "In pipeline"],
    paid: ["green", "Paid"],
    cancelled: ["gray", "Cancelled"],
    OUT_OF_STOCK: ["red", "Out of stock"],
    LOW_STOCK: ["orange", "Low stock"],
    IN_STOCK: ["green", "In stock"],
    GOOD: ["green", "Good"],
    AT_RISK: ["orange", "At risk"],
    POOR: ["red", "Poor"],
    NO_DATA: ["gray", "No data"],
    NEW: ["blue", "New seller"],
  };
  const [tone, label] = map[status] ?? ["gray", status.replace(/_/g, " ").toLowerCase()];
  return <Badge tone={tone}>{label}</Badge>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-border-soft bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}

export function Btn({
  children,
  variant = "primary",
  size = "md",
  loading,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "brand" | "outline" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean }) {
  const variants = {
    primary: "bg-ink text-paper hover:bg-navy dark:bg-brand dark:text-ink dark:hover:bg-brand-light",
    brand: "bg-brand text-ink hover:bg-brand-light",
    outline: "border border-border-strong bg-card text-foreground hover:bg-mist",
    ghost: "text-foreground hover:bg-mist",
    danger: "border border-red-500/30 bg-card text-red-700 hover:bg-red-500/10 dark:text-red-300",
  };
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variants[variant],
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-border-soft bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className={cn("relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-soft bg-card px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-mist" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer ? <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border-soft bg-card px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, text, action }: { icon?: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-muted-foreground">
        <Icon className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-mist" />
      ))}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      <span>{message}</span>
      {onRetry ? (
        <Btn size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Btn>
      ) : null}
    </div>
  );
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border-soft px-5 py-3 text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Btn size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Btn>
        <Btn size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Btn>
      </div>
    </div>
  );
}

export function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-soft bg-mist">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="text-[10px] text-muted-foreground">No image</span>
      )}
    </span>
  );
}

/** Table primitives with the panel look. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("whitespace-nowrap border-b border-border-soft bg-mist/60 px-4 py-3 text-xs font-semibold text-muted-foreground", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-border-soft px-4 py-3 align-middle text-foreground", className)}>{children}</td>;
}

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function errorMessage(err: unknown, fallback = "Something went wrong") {
  return err instanceof Error ? err.message : fallback;
}
