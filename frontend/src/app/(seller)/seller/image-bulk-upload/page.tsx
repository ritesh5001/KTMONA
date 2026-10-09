"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Ban, Download, FileSpreadsheet, Loader2, PlusCircle, X } from "lucide-react";
import { supplier } from "@/services/seller-supplier";
import { useImageKitUpload } from "@/lib/use-imagekit-upload";
import { Btn, Modal, PageHeader, PageShell, errorMessage } from "@/components/seller/kit";
import { CategoryColumns, categoryPathLabel, useCategoryTree } from "@/components/seller/CategoryColumns";
import { NOT_ALLOWED_IMAGES } from "@/components/seller/catalog-attributes";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 200;

export default function ImageBulkUploadPage() {
  const params = useSearchParams();
  const { byId } = useCategoryTree();
  const { upload } = useImageKitUpload("/catalogs/bulk");
  const [images, setImages] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [categoryId, setCategoryId] = React.useState<string | null>(params.get("category"));
  const [pickOpen, setPickOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMAGES - images.length);
    if (!list.length) return;
    setPending((n) => n + list.length);
    for (const f of list) {
      try {
        const url = await upload(f);
        setImages((prev) => [...prev, url]);
      } catch (err) {
        toast.error(`${f.name}: ${errorMessage(err, "upload failed")}`);
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const generate = async () => {
    if (!categoryId) {
      setPickOpen(true);
      return;
    }
    setBusy(true);
    try {
      await supplier.downloadPrefilledTemplate(categoryId, images);
      toast.success("Prefilled template downloaded. Fill the details and upload it from Add Catalog in Bulk.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const path = categoryId ? (byId.get(categoryId)?.path ?? []) : [];

  return (
    <PageShell>
      <PageHeader title="Image Bulk Upload" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-card p-4 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Introducing pre-filled templates for faster bulk uploads</p>
              <p className="text-xs text-muted-foreground">Add product front images and get a prefilled catalog template</p>
            </div>
            <Btn variant="outline" onClick={() => inputRef.current?.click()}>
              Get Started
            </Btn>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card p-6 text-center transition-colors",
              dragging ? "border-brand bg-brand/5" : "border-border-strong"
            )}
          >
            <button type="button" onClick={() => inputRef.current?.click()} className="flex flex-col items-center gap-2">
              <PlusCircle className="h-8 w-8 text-ink dark:text-brand" />
              <span className="text-base font-semibold">Add Images</span>
              <span className="text-xs text-muted-foreground">You can drop images here (front image of each product, up to {MAX_IMAGES})</span>
            </button>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {images.length || pending ? (
            <div className="rounded-2xl border border-border-soft bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {images.length} image(s) uploaded {pending ? <span className="text-muted-foreground">· {pending} uploading…</span> : null}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {categoryId ? (
                    <button type="button" onClick={() => setPickOpen(true)} className="text-xs text-muted-foreground hover:text-foreground">
                      Category: <b className="text-foreground">{categoryPathLabel(path)}</b> (change)
                    </button>
                  ) : null}
                  <Btn variant="primary" disabled={!images.length || pending > 0} loading={busy} onClick={generate}>
                    <Download className="h-4 w-4" /> Generate Prefilled Template
                  </Btn>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {images.map((url, i) => (
                  <span key={url} className="relative aspect-square overflow-hidden rounded-lg border border-border-soft bg-mist">
                    <img src={url} alt={`Product ${i + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute bottom-0 left-0 rounded-tr bg-ink/75 px-1 text-[10px] text-white">P{String(i + 1).padStart(3, "0")}</span>
                    <button type="button" onClick={() => setImages((prev) => prev.filter((u) => u !== url))} className="absolute right-1 top-1 rounded-full bg-ink/70 p-0.5 text-white" aria-label="Remove image">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {Array.from({ length: pending }).map((_, i) => (
                  <span key={`p${i}`} className="flex aspect-square items-center justify-center rounded-lg border border-border-soft bg-mist">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Next: fill the downloaded sheet (title, sizes, prices, stock) and upload it from{" "}
                <Link href={categoryId ? `/seller/catalog-uploads/bulk` : "/seller/catalog-uploads/bulk"} className="font-semibold text-ink hover:underline dark:text-brand">
                  Add Catalog in Bulk
                </Link>
                .
              </p>
            </div>
          ) : null}
        </div>

        <aside className="h-fit rounded-2xl border border-border-soft bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
            <Ban className="h-4 w-4" /> Image types which are not allowed
          </p>
          <ul className="mt-3 space-y-2">
            {NOT_ALLOWED_IMAGES.map((t) => (
              <li key={t} className="flex items-center justify-between gap-2 rounded-lg border border-border-soft px-3 py-2 text-sm">
                {t}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600">
                  <Ban className="h-3 w-3" /> NOT ALLOWED
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <Modal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="Select category for the template"
        wide
        footer={
          <Btn variant="primary" disabled={!categoryId} onClick={() => { setPickOpen(false); if (images.length) void generate(); }}>
            Continue
          </Btn>
        }
      >
        <CategoryColumns value={categoryId} onChange={setCategoryId} />
      </Modal>
    </PageShell>
  );
}
