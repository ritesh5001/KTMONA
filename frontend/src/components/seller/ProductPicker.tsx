"use client";

import * as React from "react";
import useSWR from "swr";
import { sellerCenter, inr } from "@/services/seller-center";
import { SearchBox, Thumb, useDebounced } from "@/components/seller/kit";

/** Multi-select of the seller's live products (offers, ad campaigns). */
export function ProductPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data } = useSWR(["seller-catalog-live", q], () => sellerCenter.catalog({ tab: "live", search: q }));
  const products = data?.products ?? [];
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="space-y-2">
      <SearchBox value={search} onChange={setSearch} placeholder="Search your live products" />
      <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-border-soft p-2">
        {products.length === 0 ? <p className="p-3 text-center text-xs text-muted-foreground">No live products</p> : null}
        {products.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-mist">
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-[var(--color-brand)]" />
            <Thumb src={p.image} alt={p.title} />
            <span className="flex-1 truncate text-sm">{p.title}</span>
            <span className="text-xs text-muted-foreground">{p.priceMin != null ? inr.format(p.priceMin) : ""}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{selected.length} product(s) selected</p>
    </div>
  );
}
