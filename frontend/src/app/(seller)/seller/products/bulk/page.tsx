"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, UploadCloud, XCircle } from "lucide-react";
import { getCategories } from "@/services/catalog";
import { sellerCenter } from "@/services/seller-center";
import { Btn, Field, PageHeader, PageShell, Panel, errorMessage, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

type Report = Awaited<ReturnType<typeof sellerCenter.bulkUpload>>;

export default function BulkUploadPage() {
  const { data: cats } = useSWR("categories", () => getCategories());
  const categories = cats?.categories ?? [];
  const [categoryId, setCategoryId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [report, setReport] = React.useState<Report | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  React.useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const download = async () => {
    setDownloading(true);
    try {
      await sellerCenter.downloadCatalogTemplate(categoryId);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setReport(null);
    try {
      const res = await sellerCenter.bulkUpload(categoryId, file);
      setReport(res);
      if (res.productsCreated) toast.success(`${res.productsCreated} product(s) submitted for review`);
      if (res.rowsWithErrors) toast.error(`${res.rowsWithErrors} row(s) need fixing`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Upload the .xlsx template");
      return;
    }
    setFile(f);
    setReport(null);
  };

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="Bulk catalog upload"
        description="List many products at once with an Excel sheet. Each row is one variant (size/colour); rows with the same Product Group ID become one product."
        breadcrumb={{ label: "My Products", href: "/seller/products" }}
      />

      <Panel title="1 · Choose a category and download the template">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Category">
              <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Btn variant="primary" loading={downloading} disabled={!categoryId} onClick={download}>
            <Download className="h-4 w-4" /> Download template
          </Btn>
        </div>
        <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>• Fill the <b>Catalog</b> sheet from left to right. Columns with * are required.</li>
          <li>• Image URLs: up to 5 https links, comma-separated.</li>
          <li>• &ldquo;Your Price&rdquo; is what you want to receive before commission.</li>
          <li>• Delete the two grey sample rows (or leave them, they are skipped).</li>
        </ul>
      </Panel>

      <Panel title="2 · Upload the filled sheet">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragOver ? "border-brand bg-brand/5" : "border-border-strong hover:border-brand/60"
          )}
        >
          <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
          {file ? (
            <>
              <FileSpreadsheet className="h-10 w-10 text-emerald-600" />
              <p className="mt-2 text-sm font-semibold text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · click to change</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">Drop your .xlsx here or click to browse</p>
              <p className="text-xs text-muted-foreground">Up to 10 MB</p>
            </>
          )}
        </label>
        <div className="mt-4 flex justify-end">
          <Btn variant="brand" loading={uploading} disabled={!file || !categoryId} onClick={upload}>
            <UploadCloud className="h-4 w-4" /> Upload & submit for review
          </Btn>
        </div>
      </Panel>

      {report ? (
        <Panel title="Upload report">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-xl font-semibold">{report.productsCreated}</p>
                <p className="text-xs text-muted-foreground">products submitted for review</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/5 p-4">
              <XCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="text-xl font-semibold">{report.rowsWithErrors}</p>
                <p className="text-xs text-muted-foreground">rows with errors</p>
              </div>
            </div>
          </div>
          {report.errors.length > 0 ? (
            <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-border-soft">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-mist/60 text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-semibold">Row</th>
                    <th className="px-4 py-2 font-semibold">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {report.errors.map((e, i) => (
                    <tr key={i} className="border-t border-border-soft">
                      <td className="px-4 py-2 font-semibold tabular-nums">{e.row}</td>
                      <td className="px-4 py-2 text-red-700 dark:text-red-300">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {report.productsCreated > 0 ? (
            <div className="mt-4">
              <Link href="/seller/products?tab=under_review">
                <Btn variant="outline">View products under review</Btn>
              </Link>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </PageShell>
  );
}
