"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { foundersApi, type Founder } from "@/services/platform";
import { useImageKitUpload } from "@/lib/use-imagekit-upload";
import { Btn, Empty, ErrorNote, Field, Loading, PageHeader, PageShell, errorMessage, inputCls } from "@/components/seller/kit";

const blank = (): Founder => ({ name: "", title: "", bio: "", quote: null, photoUrl: null });

/** Founders shown on the website's About Us page (and the app's About screen). */
export default function FoundersPage() {
  const { data, error, isLoading, mutate } = useSWR("admin-founders", foundersApi.adminList);
  const [list, setList] = React.useState<Founder[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (data) setList(data.founders);
  }, [data]);

  const set = (i: number, patch: Partial<Founder>) => setList((l) => l.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) =>
    setList((l) => {
      if (i + d < 0 || i + d >= l.length) return l;
      const n = [...l];
      [n[i], n[i + d]] = [n[i + d]!, n[i]!];
      return n;
    });

  const save = async () => {
    if (list.some((f) => f.name.trim().length < 2)) {
      toast.error("Every founder needs a name");
      return;
    }
    setSaving(true);
    try {
      await mutate(foundersApi.save(list.map((f) => ({ ...f, quote: f.quote?.trim() || null, photoUrl: f.photoUrl || null }))), { revalidate: false });
      toast.success("Saved. The About Us page updates within 5 minutes.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="About Us: Founders"
        description="Add, edit, reorder or remove the founders shown on the About Us page."
        actions={
          <>
            <Btn variant="outline" onClick={() => setList((l) => [...l, blank()])}><Plus className="h-4 w-4" /> Add founder</Btn>
            <Btn variant="brand" loading={saving} disabled={!data} onClick={save}>Save</Btn>
          </>
        }
      />
      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty icon={UserRound} title="No founders listed" text="The About Us page hides the founders section until you add one." />
      ) : (
        <div className="space-y-4">
          {list.map((f, i) => (
            <div key={i} className="rounded-2xl border border-border-soft bg-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <Photo url={f.photoUrl} onChange={(photoUrl) => set(i, { photoUrl })} />
                <div className="grid flex-1 gap-4 md:grid-cols-2">
                  <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Mr. Kuldeep Yadav" /></Field>
                  <Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Founder & CEO, KTMONA" /></Field>
                  <div className="md:col-span-2"><Field label="About"><textarea rows={4} className={`${inputCls} h-auto py-2`} value={f.bio} onChange={(e) => set(i, { bio: e.target.value })} /></Field></div>
                  <div className="md:col-span-2"><Field label="Quote (optional)"><textarea rows={2} className={`${inputCls} h-auto py-2`} value={f.quote ?? ""} onChange={(e) => set(i, { quote: e.target.value })} /></Field></div>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Btn size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /> Up</Btn>
                <Btn size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === list.length - 1}><ArrowDown className="h-4 w-4" /> Down</Btn>
                <Btn size="sm" variant="danger" onClick={() => { if (window.confirm(`Remove ${f.name || "this founder"}? Click Save to apply.`)) setList((l) => l.filter((_, j) => j !== i)); }}><Trash2 className="h-4 w-4" /> Remove</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function Photo({ url, onChange }: { url: string | null; onChange: (url: string | null) => void }) {
  const { upload, uploading } = useImageKitUpload("/founders");
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={() => ref.current?.click()} className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong bg-mist" aria-label="Upload photo">
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : url ? (
           
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        )}
      </button>
      {url ? <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => onChange(null)}>Remove photo</button> : <span className="text-xs text-muted-foreground">Photo (optional)</span>}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onChange(await upload(file));
          } catch (err) {
            toast.error(errorMessage(err, "Upload failed"));
          }
        }}
      />
    </div>
  );
}
