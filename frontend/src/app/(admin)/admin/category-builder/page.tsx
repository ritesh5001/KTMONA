"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
  type AdminCategory,
} from "@/services/admin";
import { categoryFieldsApi, type CategoryField, type CategoryFieldType } from "@/services/platform";
import { attributesFor } from "@/components/seller/catalog-attributes";
import { Badge, Btn, ErrorNote, Loading, PageHeader, PageShell, SearchBox, errorMessage, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

/**
 * Meesho-style column view of the whole category tree: pick a category to see
 * its sub-categories in the next column; add, rename or delete at any level.
 * The panel on the right edits the "Product Details" fields sellers fill for
 * products in the selected category, including which ones are required (*).
 */
export default function CategoryBuilderPage() {
  const { data, error, isLoading, mutate } = useSWR("admin-category-builder", () => getAdminCategories());
  const all = React.useMemo(() => data?.categories ?? [], [data]);
  const childrenOf = React.useCallback(
    (parentId: string | null) =>
      all
        .filter((c) => (c.parentId ?? null) === parentId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [all]
  );
  const byId = React.useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const [path, setPath] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");

  // Drop selections that no longer exist (after a delete).
  React.useEffect(() => {
    if (path.some((id) => !byId.has(id))) setPath((p) => p.slice(0, p.findIndex((id) => !byId.has(id))));
  }, [byId, path]);

  const selectedId = path[path.length - 1] ?? null;
  const columns: { parentId: string | null; items: AdminCategory[] }[] = [
    { parentId: null, items: childrenOf(null) },
    ...path.map((id) => ({ parentId: id, items: childrenOf(id) })),
  ];

  const q = search.trim().toLowerCase();
  const results = q ? all.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 30) : [];
  const pathTo = (id: string): string[] => {
    const out: string[] = [];
    let cur = byId.get(id);
    for (let g = 0; cur && g < 10; g += 1) {
      out.unshift(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out;
  };
  const label = (id: string) => pathTo(id).map((x) => byId.get(x)?.name).join(" › ");

  return (
    <PageShell>
      <PageHeader
        title="Category Builder"
        description="Build the category tree sellers pick from: open a category to see the categories inside it, then add, rename or delete at any level. Select a category to choose the product-detail fields sellers fill for it and which of them are required (*)."
      />
      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <SearchBox value={search} onChange={setSearch} placeholder="Search categories, e.g. T-shirts" />
            {results.length ? (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border-soft bg-card shadow-lg">
                {results.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-mist" onClick={() => { setPath(pathTo(c.id)); setSearch(""); }}>
                      {label(c.id)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex gap-0 overflow-x-auto rounded-2xl border border-border-soft bg-card">
            {columns.map((col, depth) => (
              <Column
                key={`${col.parentId ?? "root"}-${depth}`}
                parentId={col.parentId}
                items={col.items}
                selected={path[depth] ?? null}
                onSelect={(id) => setPath([...path.slice(0, depth), id])}
                hasChildren={(id) => childrenOf(id).length > 0}
                onChanged={() => mutate()}
              />
            ))}
          </div>

          {selectedId ? <FieldsEditor key={selectedId} categoryId={selectedId} pathLabel={label(selectedId)} pathNames={pathTo(selectedId).map((x) => byId.get(x)?.name ?? "")} /> : (
            <p className="text-sm text-muted-foreground">Select a category to edit its product-detail fields.</p>
          )}
        </div>
      )}
    </PageShell>
  );
}

/* ── One column of categories ───────────────────────────────────────────── */

function Column({
  parentId,
  items,
  selected,
  onSelect,
  hasChildren,
  onChanged,
}: {
  parentId: string | null;
  items: AdminCategory[];
  selected: string | null;
  onSelect: (id: string) => void;
  hasChildren: (id: string) => boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const add = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      await createAdminCategory({ name: name.trim(), ...(parentId ? { parentId } : {}), sortOrder: items.length });
      toast.success(`Added “${name.trim()}”`);
      setName("");
      setAdding(false);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const rename = async (c: AdminCategory) => {
    if (editName.trim().length < 2 || editName.trim() === c.name) {
      setEditing(null);
      return;
    }
    setBusy(true);
    try {
      await updateAdminCategory(c.id, { name: editName.trim() });
      toast.success("Renamed");
      setEditing(null);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: AdminCategory) => {
    if (hasChildren(c.id)) {
      toast.error(`Delete or move the categories inside “${c.name}” first.`);
      return;
    }
    if (!window.confirm(`Delete “${c.name}”? This can't be undone. Categories with products can't be deleted.`)) return;
    setBusy(true);
    try {
      await deleteAdminCategory(c.id);
      toast.success("Deleted");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-border-soft last:border-r-0">
      <ul className="max-h-[420px] flex-1 overflow-y-auto py-1">
        {items.length === 0 ? <li className="px-3 py-2 text-xs text-muted-foreground">No categories here yet.</li> : null}
        {items.map((c) => {
          const on = c.id === selected;
          if (editing === c.id) {
            return (
              <li key={c.id} className="flex items-center gap-1 px-2 py-1">
                <input className={cn(inputCls, "h-8")} value={editName} autoFocus onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void rename(c); if (e.key === "Escape") setEditing(null); }} />
                <button type="button" className="rounded p-1 hover:bg-mist" onClick={() => void rename(c)} aria-label="Save"><Check className="h-4 w-4" /></button>
                <button type="button" className="rounded p-1 hover:bg-mist" onClick={() => setEditing(null)} aria-label="Cancel"><X className="h-4 w-4" /></button>
              </li>
            );
          }
          return (
            <li key={c.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(c.id)}
                onKeyDown={(e) => { if (e.key === "Enter") onSelect(c.id); }}
                className={cn(
                  "group flex cursor-pointer items-center gap-1 px-3 py-2 text-sm",
                  on ? "bg-ink text-paper dark:bg-brand dark:text-ink" : "hover:bg-mist",
                  !c.isActive && "opacity-60"
                )}
              >
                <span className="flex-1 truncate">{c.name}</span>
                <span className={cn("flex gap-0.5", on ? "" : "opacity-0 group-hover:opacity-100")}>
                  <button type="button" disabled={busy} title="Rename" className="rounded p-1 hover:bg-black/10" onClick={(e) => { e.stopPropagation(); setEditing(c.id); setEditName(c.name); }}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={busy} title="Delete" className="rounded p-1 hover:bg-black/10" onClick={(e) => { e.stopPropagation(); void remove(c); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
                {hasChildren(c.id) ? <ChevronRight className="h-4 w-4 shrink-0" /> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border-soft p-2">
        {adding ? (
          <div className="flex items-center gap-1">
            <input className={cn(inputCls, "h-8")} autoFocus value={name} placeholder="New category name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); if (e.key === "Escape") setAdding(false); }} />
            <button type="button" className="rounded p-1 hover:bg-mist" disabled={busy} onClick={() => void add()} aria-label="Add"><Check className="h-4 w-4" /></button>
            <button type="button" className="rounded p-1 hover:bg-mist" onClick={() => setAdding(false)} aria-label="Cancel"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-strong hover:bg-mist">
            <Plus className="h-4 w-4" /> {parentId ? "Add sub-category" : "Add main category"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Product-detail fields for the selected category ─────────────────────── */

type Draft = CategoryField & { optionsText: string };

const toDraft = (f: CategoryField): Draft => ({ ...f, optionsText: f.options.join("\n") });

function FieldsEditor({ categoryId, pathLabel, pathNames }: { categoryId: string; pathLabel: string; pathNames: string[] }) {
  const { data, isLoading, mutate } = useSWR(["admin-category-fields", categoryId], () => categoryFieldsApi.adminGet(categoryId));
  const [fields, setFields] = React.useState<Draft[] | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (data) setFields(data.own.length ? data.own.map(toDraft) : null);
  }, [data]);

  const startFrom = (list: CategoryField[]) => setFields(list.map(toDraft));
  const builtIn = (): CategoryField[] =>
    attributesFor(pathNames).map((a) => ({
      key: a.key,
      label: a.label,
      type: a.options ? "SELECT" : "TEXT",
      options: a.options ?? [],
      required: Boolean(a.required),
      placeholder: a.placeholder ?? null,
    }));

  const set = (i: number, patch: Partial<Draft>) => setFields((f) => f && f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setFields((f) => {
      if (!f || i + d < 0 || i + d >= f.length) return f;
      const n = [...f];
      [n[i], n[i + d]] = [n[i + d]!, n[i]!];
      return n;
    });

  const save = async (list: Draft[]) => {
    setSaving(true);
    try {
      await categoryFieldsApi.adminSave(
        categoryId,
        list.map((f) => ({
          key: f.key,
          label: f.label.trim(),
          type: f.type,
          options: f.type === "SELECT" ? f.optionsText.split(/\n|,/).map((o) => o.trim()).filter(Boolean) : [],
          required: f.required,
          placeholder: f.placeholder?.trim() || null,
        }))
      );
      toast.success(list.length ? "Fields saved. Sellers see them on the catalog form now." : "Custom fields removed. This category uses its parent's fields again.");
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !data) return <Loading rows={3} />;

  return (
    <div className="rounded-2xl border border-border-soft bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Product details form</h2>
          <p className="text-sm text-muted-foreground">{pathLabel}</p>
        </div>
        {fields ? (
          <div className="flex gap-2">
            {data.own.length ? <Btn variant="ghost" size="sm" disabled={saving} onClick={() => { if (window.confirm("Remove this category's own fields and use its parent's again?")) void save([]); }}>Use parent&apos;s fields</Btn> : null}
            <Btn variant="brand" size="sm" loading={saving} onClick={() => void save(fields)}>Save fields</Btn>
          </div>
        ) : null}
      </div>

      {!fields ? (
        <div className="mt-4 rounded-xl bg-mist p-4 text-sm">
          {data.inherited ? (
            <p>Uses the fields of <strong>{data.inherited.from.name}</strong> ({data.inherited.fields.length} fields). Sub-categories always use their nearest parent&apos;s fields unless you customise them here.</p>
          ) : (
            <p>Uses KTMONA&apos;s built-in fields for this kind of product.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {data.inherited ? <Btn size="sm" variant="outline" onClick={() => startFrom(data.inherited!.fields)}>Customise (start from {data.inherited.from.name})</Btn> : null}
            <Btn size="sm" variant="outline" onClick={() => startFrom(builtIn())}>Customise (start from built-in fields)</Btn>
            <Btn size="sm" variant="ghost" onClick={() => startFrom([])}>Start empty</Btn>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-semibold">Field name</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">Options (click one to edit)</th>
                  <th className="px-2 py-2 text-center font-semibold">Required *</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => (
                  <tr key={i} className="border-t border-border-soft align-top">
                    <td className="px-2 py-2">
                      <input className={cn(inputCls, "h-9")} value={f.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="e.g. Fabric" />
                      {f.type !== "SELECT" ? <input className={cn(inputCls, "mt-1 h-8 text-xs")} value={f.placeholder ?? ""} onChange={(e) => set(i, { placeholder: e.target.value })} placeholder="Hint shown in the box (optional)" /> : null}
                    </td>
                    <td className="px-2 py-2">
                      <select className={cn(inputCls, "h-9")} value={f.type} onChange={(e) => set(i, { type: e.target.value as CategoryFieldType })}>
                        <option value="SELECT">Drop-down</option>
                        <option value="TEXT">Text</option>
                        <option value="NUMBER">Number</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      {f.type === "SELECT" ? (
                        <OptionsEditor value={f.optionsText} onChange={(optionsText) => set(i, { optionsText })} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Seller types the value</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input type="checkbox" checked={f.required} onChange={(e) => set(i, { required: e.target.checked })} />
                        {f.required ? <Badge tone="orange">*</Badge> : <span className="text-xs text-muted-foreground">Optional</span>}
                      </label>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-0.5">
                        <button type="button" className="rounded p-1 hover:bg-mist" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1 hover:bg-mist" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1 text-red-600 hover:bg-mist" onClick={() => setFields((x) => x && x.filter((_, j) => j !== i))} aria-label="Remove field"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Btn variant="outline" size="sm" className="mt-3" onClick={() => setFields((x) => [...(x ?? []), { label: "", type: "SELECT", options: [], optionsText: "", required: false, placeholder: null }])}>
            <Plus className="h-4 w-4" /> Add field
          </Btn>
          <p className="mt-3 text-xs text-muted-foreground">
            Product name, sizes, prices, inventory, images and legal details are always on the form. Fields set here apply to this category and every sub-category inside it that has no fields of its own.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Drop-down options as editable chips: every option is visible, each one can
 * be renamed in place or removed, and new ones are added one by one (or many
 * at once, comma / new-line separated). Stored as one option per line.
 */
function OptionsEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const options = value.split(/\n/).map((o) => o.trim()).filter(Boolean);
  const [draft, setDraft] = React.useState("");
  const write = (list: string[]) => onChange(list.join("\n"));
  const add = () => {
    const extra = draft.split(/\n|,/).map((o) => o.trim()).filter(Boolean);
    if (!extra.length) return;
    const seen = new Set(options.map((o) => o.toLowerCase()));
    write([...options, ...extra.filter((o) => !seen.has(o.toLowerCase()) && seen.add(o.toLowerCase()))]);
    setDraft("");
  };
  return (
    <div className="min-w-[260px] space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o, idx) => (
          <span key={`${idx}-${o}`} className="inline-flex items-center rounded-full border border-border-soft bg-mist/60 pl-2.5 pr-1 text-xs">
            <input
              className="min-w-[3ch] bg-transparent py-1 outline-none"
              style={{ width: `${Math.max(3, o.length + 1)}ch` }}
              defaultValue={o}
              aria-label={`Option ${o}`}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next === o) return;
                write(next ? options.map((x, j) => (j === idx ? next : x)) : options.filter((_, j) => j !== idx));
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLInputElement).blur())}
            />
            <button type="button" className="rounded-full p-0.5 text-muted-foreground hover:bg-card hover:text-red-600" aria-label={`Remove ${o}`} onClick={() => write(options.filter((_, j) => j !== idx))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {options.length === 0 ? <span className="text-xs text-red-600">Add at least one option</span> : null}
      </div>
      <div className="flex gap-1.5">
        <input
          className={cn(inputCls, "h-8 text-xs")}
          value={draft}
          placeholder="Add option (e.g. Maroon, Teal)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Btn size="sm" variant="outline" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Btn>
      </div>
      <p className="text-[11px] text-muted-foreground">{options.length} options · sellers can also type their own value</p>
    </div>
  );
}
