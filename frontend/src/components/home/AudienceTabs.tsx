"use client";

export type Audience = "MENS" | "KIDS";

interface AudienceTabsProps {
  value: Audience;
  onChange: (next: Audience) => void;
  className?: string;
}

export function AudienceTabs({ value, onChange, className }: AudienceTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Audience"
      className={`inline-flex items-center border border-border-soft bg-card ${className ?? ""}`}
    >
      {(["MENS", "KIDS"] as const).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className={`h-9 px-4 text-[11px] font-medium uppercase tracking-[0.2em] transition-colors ${
              active
                ? "bg-ink text-paper dark:bg-brand dark:text-ink"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt === "MENS" ? "Mens" : "Kids"}
          </button>
        );
      })}
    </div>
  );
}
