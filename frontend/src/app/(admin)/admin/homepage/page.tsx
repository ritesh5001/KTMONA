"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { adminCenter, type HomeBannerItem, type HomeBanners } from "@/services/admin-center";
import { Btn, ErrorNote, Field, Loading, PageHeader, PageShell, Panel, errorMessage, inputCls } from "@/components/seller/kit";
import { useImageKitUpload } from "@/lib/use-imagekit-upload";

const EMPTY_BANNER: HomeBannerItem = { imageUrl: "", mobileImageUrl: null, href: "", alt: "" };

export default function HomepageBannersPage() {
  const { data, error, isLoading, mutate } = useSWR("admin-home-banners", () => adminCenter.homeBanners());
  const [draft, setDraft] = React.useState<HomeBanners | null>(null);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { if (data && !draft) setDraft(data); }, [data, draft]);

  const setHero = (fn: (hero: HomeBannerItem[]) => HomeBannerItem[]) => setDraft((d) => (d ? { ...d, hero: fn(d.hero) } : d));
  const dirty = JSON.stringify(draft) !== JSON.stringify(data);
  const incomplete = draft ? [...draft.hero, ...(draft.promo ? [draft.promo] : [])].some((b) => !b.imageUrl) : false;

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const clean = (b: HomeBannerItem): HomeBannerItem => ({
        imageUrl: b.imageUrl.trim(),
        mobileImageUrl: b.mobileImageUrl?.trim() || null,
        href: b.href?.trim() || null,
        alt: b.alt.trim(),
      });
      const saved = await adminCenter.saveHomeBanners({ hero: draft.hero.map(clean), promo: draft.promo ? clean(draft.promo) : null });
      await mutate(saved, { revalidate: false });
      setDraft(saved);
      toast.success("Homepage banners saved. The storefront updates within a few minutes.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Homepage Banners"
        description="Upload the banners shown at the top of the storefront homepage. While no banners are added here, the homepage shows KTMONA's built-in designs."
        actions={<Btn variant="brand" loading={saving} disabled={!dirty || incomplete} onClick={save}>Save changes</Btn>}
      />

      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading || !draft ? (
        <Loading rows={3} />
      ) : (
        <>
          <Panel
            title={`Hero carousel (${draft.hero.length}/8)`}
            action={
              <Btn size="sm" variant="outline" disabled={draft.hero.length >= 8} onClick={() => setHero((h) => [...h, { ...EMPTY_BANNER }])}>
                <Plus className="h-4 w-4" /> Add banner
              </Btn>
            }
          >
            <p className="mb-4 text-sm text-muted-foreground">
              Desktop size: 1440 × 400 px. Phone size (optional): 800 × 450 px. Banners rotate every 5 seconds in this order.
            </p>
            {draft.hero.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-soft p-8 text-center text-sm text-muted-foreground">
                No custom banners. The built-in KTMONA banners are showing.
              </div>
            ) : (
              <div className="space-y-4">
                {draft.hero.map((banner, i) => (
                  <BannerEditor
                    key={i}
                    banner={banner}
                    label={`Banner ${i + 1}`}
                    onChange={(b) => setHero((h) => h.map((x, j) => (j === i ? b : x)))}
                    onRemove={() => setHero((h) => h.filter((_, j) => j !== i))}
                    onUp={i > 0 ? () => setHero((h) => swap(h, i, i - 1)) : undefined}
                    onDown={i < draft.hero.length - 1 ? () => setHero((h) => swap(h, i, i + 1)) : undefined}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Festive promo banner"
            action={
              draft.promo ? null : (
                <Btn size="sm" variant="outline" onClick={() => setDraft((d) => (d ? { ...d, promo: { ...EMPTY_BANNER } } : d))}>
                  <Plus className="h-4 w-4" /> Add banner
                </Btn>
              )
            }
          >
            <p className="mb-4 text-sm text-muted-foreground">
              Replaces the dark &ldquo;Wedding &amp; Festive Edit&rdquo; band below the categories. Suggested size: 1440 × 480 px.
            </p>
            {draft.promo ? (
              <BannerEditor
                banner={draft.promo}
                label="Promo banner"
                onChange={(b) => setDraft((d) => (d ? { ...d, promo: b } : d))}
                onRemove={() => setDraft((d) => (d ? { ...d, promo: null } : d))}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border-soft p-8 text-center text-sm text-muted-foreground">
                Using the built-in festive design.
              </div>
            )}
          </Panel>

          {incomplete ? <p className="text-sm text-red-600">Every banner needs a desktop image before you can save.</p> : null}
        </>
      )}
    </PageShell>
  );
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
}

function BannerEditor({
  banner,
  label,
  onChange,
  onRemove,
  onUp,
  onDown,
}: {
  banner: HomeBannerItem;
  label: string;
  onChange: (b: HomeBannerItem) => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const set = (patch: Partial<HomeBannerItem>) => onChange({ ...banner, ...patch });
  return (
    <div className="rounded-xl border border-border-soft p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex gap-1">
          {onUp ? <Btn size="sm" variant="ghost" onClick={onUp} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Btn> : null}
          {onDown ? <Btn size="sm" variant="ghost" onClick={onDown} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Btn> : null}
          <Btn size="sm" variant="ghost" onClick={onRemove} aria-label="Remove banner"><Trash2 className="h-4 w-4 text-red-600" /></Btn>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ImageField label="Desktop image" value={banner.imageUrl} onChange={(imageUrl) => set({ imageUrl })} aspect="aspect-[1440/400]" />
        <ImageField label="Phone image (optional)" value={banner.mobileImageUrl ?? ""} onChange={(v) => set({ mobileImageUrl: v || null })} aspect="aspect-[16/9] max-w-xs" />
        <Field label="Link (where the banner goes)" hint="e.g. /collections/kurti-saree or /sale/mega-sale">
          <input className={inputCls} value={banner.href ?? ""} onChange={(e) => set({ href: e.target.value })} placeholder="/collections/…" />
        </Field>
        <Field label="Description (for screen readers)">
          <input className={inputCls} value={banner.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="Festive sale on sarees" />
        </Field>
      </div>
    </div>
  );
}

function ImageField({ label, value, onChange, aspect }: { label: string; value: string; onChange: (url: string) => void; aspect: string }) {
  const { upload, uploading } = useImageKitUpload("/ktmona/banners");
  const input = React.useRef<HTMLInputElement | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await upload(file));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className={`relative overflow-hidden rounded-lg border border-border-soft bg-mist ${aspect}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><ImagePlus className="h-6 w-6" /></div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        <Btn size="sm" variant="outline" loading={uploading} onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" /> Upload
        </Btn>
        <input className={`${inputCls} h-9 flex-1 text-xs`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="or paste an image URL" />
      </div>
    </div>
  );
}
