"use client";

import * as React from "react";
import useSWR from "swr";
import { ChevronDown, X } from "lucide-react";
import { browseCategories, type CategoryBrief } from "@/services/catalog";
import { Btn, Modal } from "@/components/seller/kit";
import { LazyCategoryBrowser } from "./LazyCategoryBrowser";
import { cn } from "@/lib/utils";

/** "Main / Group / Name" for a category id (one small request, cached). */
export function useCategoryLabel(id: string | null | undefined, admin = false) {
  const { data } = useSWR(id ? ["cat-ids", admin, id] : null, () => browseCategories({ ids: [id!] }, { admin }), { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 });
  const cat = data?.categories[0];
  return { label: cat?.path?.join(" / ") ?? cat?.name ?? null, category: cat ?? null };
}

/**
 * Replaces a category <select> now that the tree is too big to list in one
 * dropdown: shows the chosen category and opens a popup to browse or search.
 */
export function CategoryField({
  value,
  onChange,
  placeholder = "Choose a category",
  clearLabel,
  leafOnly = true,
  admin = false,
  className,
  title = "Select category",
  disabled,
  fallbackLabel,
}: {
  value: string | null | undefined;
  onChange: (id: string | null, category: CategoryBrief | null) => void;
  placeholder?: string;
  /** When set, a clear button is shown and the field reads this when empty (e.g. "All categories"). */
  clearLabel?: string;
  leafOnly?: boolean;
  admin?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  /** Shown while the label loads, or if the category cannot be found. */
  fallbackLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const { label } = useCategoryLabel(value ?? null, admin);
  const text = value ? label ?? fallbackLabel ?? "Loading…" : clearLabel ?? placeholder;

  return (
    <>
      <div className={cn("flex items-center gap-1", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-border-soft bg-card px-3 text-left text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{text}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
        {clearLabel && value ? (
          <button type="button" aria-label="Clear category" onClick={() => onChange(null, null)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-soft hover:bg-mist">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={title} footer={<Btn variant="outline" onClick={() => setOpen(false)}>Close</Btn>}>
        <LazyCategoryBrowser
          value={value ?? null}
          leafOnly={leafOnly}
          admin={admin}
          onPick={(cat) => {
            onChange(cat.id, cat);
            setOpen(false);
          }}
        />
      </Modal>
    </>
  );
}
