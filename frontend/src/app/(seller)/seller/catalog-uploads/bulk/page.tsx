"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Download, Headset, Images, Upload } from "lucide-react";
import { sellerCenter } from "@/services/seller-center";
import { Badge, Btn, errorMessage } from "@/components/seller/kit";
import { CategoryColumns, categoryPathLabel, useCategoryTree } from "@/components/seller/CategoryColumns";

type Report = Awaited<ReturnType<typeof sellerCenter.bulkUpload>>;

export default function BulkCatalogUploadPage() {
  const router = useRouter();
  const { byId } = useCategoryTree();
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"template" | "upload" | null>(null);
  const [report, setReport] = React.useState<Report | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const path = categoryId ? (byId.get(categoryId)?.path ?? []) : [];
  const leaf = path.at(-1)?.name ?? "";

  const download = async () => {
    if (!categoryId) return;
    setBusy("template");
    try {
      await sellerCenter.downloadCatalogTemplate(categoryId);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || !categoryId) return;
    setBusy("upload");
    try {
      const res = await sellerCenter.bulkUpload(categoryId, file);
      setReport(res);
      if (res.productsCreated) toast.success(`${res.productsCreated} product(s) sent for QC`);
      if (res.rowsWithErrors) toast.error(`${res.rowsWithErrors} row(s) have errors`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      <div className="border-b border-border-soft bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/seller/catalog-uploads?mode=bulk" className="inline-flex items-center gap-2 text-lg font-semibold">
            <ArrowLeft className="h-5 w-5" /> Bulk Catalog Upload
          </Link>
          <Link href="/seller/support?topic=catalog" className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <Headset className="h-4 w-4" /> Need Help?
          </Link>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 pb-24 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <CategoryColumns value={categoryId} onChange={(id) => { setCategoryId(id); setReport(null); }} />
        {categoryId ? (
          <aside className="h-fit rounded-2xl border border-border-soft bg-card">
            <p className="border-b border-border-soft bg-mist/60 px-4 py-3 text-xs text-muted-foreground">{categoryPathLabel(path)}</p>
            <div className="space-y-5 p-4">
              <div className="text-center">
                <p className="text-sm font-medium">Already have your {leaf} template filled?</p>
                <Btn variant="outline" className="mt-3 w-full" loading={busy === "upload"} onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload Template File
                </Btn>
                <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              <div className="border-t border-border-soft pt-4 text-center">
                <p className="text-sm font-medium">Don&apos;t have {leaf} template?</p>
                <Link href={`/seller/image-bulk-upload?category=${categoryId}`} className="mt-3 block rounded-xl border border-brand/40 bg-brand/5 p-3 text-left hover:bg-brand/10">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Images className="h-4 w-4 text-brand" /> Generate Prefilled Template <Badge tone="orange">Recommended</Badge>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">Upload product front images and generate your prefilled template</span>
                </Link>
                <p className="my-3 text-xs text-muted-foreground">Or</p>
                <Btn variant="primary" className="w-full" loading={busy === "template"} onClick={download}>
                  <Download className="h-4 w-4" /> Download Empty Template
                </Btn>
              </div>

              {report ? (
                <div className="space-y-2 border-t border-border-soft pt-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {report.productsCreated} product(s) created
                  </p>
                  {report.rowsWithErrors ? (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-red-500/25 bg-red-500/5 p-2 text-xs">
                      {report.errors.map((e, i) => (
                        <p key={i}>Row {e.row}: {e.message}</p>
                      ))}
                    </div>
                  ) : null}
                  <Btn variant="outline" className="w-full" onClick={() => router.push("/seller/catalog-uploads?mode=bulk")}>
                    View Bulk Uploads
                  </Btn>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
