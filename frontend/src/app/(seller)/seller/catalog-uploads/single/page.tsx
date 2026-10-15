"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Copy, Headset, ImagePlus, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { sellerCenter, inr2 } from "@/services/seller-center";
import { supplier, type CatalogProductInput } from "@/services/seller-supplier";
import { useImageKitUpload } from "@/lib/use-imagekit-upload";
import { Btn, Field, errorMessage, inputCls } from "@/components/seller/kit";
import { CategoryColumns, categoryPathLabel, useCategoryTree } from "@/components/seller/CategoryColumns";
import { IMAGE_SLOTS, LEGAL_FIELDS, NOT_ALLOWED_IMAGES, attributesFor, sizePresetsFor, type AttributeDef } from "@/components/seller/catalog-attributes";
import { cn } from "@/lib/utils";
import { categoryFieldsApi } from "@/services/platform";
import { KycGate } from "@/components/seller/KycGate";

const MAX_PRODUCTS = 9;

interface SizeRow {
  size: string;
  price: string;
  wdrp: string;
  prepaid: string;
  mrp: string;
  stock: string;
  sku: string;
}

interface ProductForm {
  name: string;
  styleCode: string;
  netWeight: string;
  description: string;
  hsnCode: string;
  gst: string;
  images: (string | null)[];
  attributes: Record<string, string>;
  legal: Record<string, string>;
  sizes: SizeRow[];
}

const emptyProduct = (front: string | null = null): ProductForm => ({
  name: "",
  styleCode: "",
  netWeight: "",
  description: "",
  hsnCode: "",
  gst: "5",
  images: [front, null, null, null, null],
  attributes: {},
  legal: { countryOfOrigin: "India" },
  sizes: [],
});

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function toPayload(p: ProductForm): CatalogProductInput {
  return {
    name: p.name.trim(),
    images: p.images.filter((x): x is string => Boolean(x)),
    styleCode: p.styleCode.trim() || null,
    netWeightGrams: Math.round(Number(p.netWeight) || 0),
    description: p.description.trim() || null,
    hsnCode: p.hsnCode.trim() || null,
    gstPercent: num(p.gst),
    color: p.attributes.Color?.trim() || null,
    attributes: Object.fromEntries(Object.entries(p.attributes).filter(([, v]) => v?.trim())),
    legal: Object.fromEntries(Object.entries(p.legal).filter(([, v]) => v?.trim())),
    sizes: p.sizes.map((s) => ({
      size: s.size,
      sellerPrice: Number(s.price),
      wdrpPrice: num(s.wdrp),
      prepaidDiscount: num(s.prepaid),
      mrp: Number(s.mrp),
      stock: Math.floor(Number(s.stock) || 0),
      sku: s.sku.trim() || null,
    })),
  };
}

/** Shown in red under MRP when it is below the seller's price. */
const mrpError = (price: string) => `Enter a price more than or equal to KTMONA price ₹${Number(price)}`;

/** Inline, red error for one price row (null when the row is fine so far). */
function sizeRowErrors(s: SizeRow, attempted: boolean): Partial<Record<keyof SizeRow, string>> {
  const e: Partial<Record<keyof SizeRow, string>> = {};
  const price = Number(s.price);
  if (attempted && !(price > 0)) e.price = "Enter your price";
  if (s.mrp.trim() && price > 0 && Number(s.mrp) < price) e.mrp = mrpError(s.price);
  else if (attempted && !(Number(s.mrp) > 0)) e.mrp = "Enter MRP";
  if (s.wdrp.trim() && price > 0 && Number(s.wdrp) > price) e.wdrp = "Can't be more than your price";
  if (s.prepaid.trim() && price > 0 && Number(s.prepaid) >= price) e.prepaid = "Must be less than your price";
  if (attempted && s.stock.trim() === "") e.stock = "Enter inventory";
  return e;
}

/** "40% off · ₹200 discount" between MRP and the seller's price. */
function discountLabel(s: SizeRow): string | null {
  const price = Number(s.price);
  const mrp = Number(s.mrp);
  if (!(price > 0) || !(mrp > price)) return null;
  return `${Math.round(((mrp - price) / mrp) * 100)}% off · ₹${Math.round((mrp - price) * 100) / 100} discount`;
}

const PRICE_KEYS: (keyof SizeRow)[] = ["price", "wdrp", "prepaid", "mrp", "stock"];

function validate(p: ProductForm, attrs: AttributeDef[], index: number): string | null {
  const n = `Product ${index + 1}`;
  if (p.name.trim().length < 3) return `${n}: enter a product name`;
  if (!p.images[0]) return `${n}: add the front image`;
  if (!(Number(p.netWeight) > 0)) return `${n}: enter net weight in grams`;
  if (p.sizes.length === 0) return `${n}: select at least one size`;
  for (const s of p.sizes) {
    if (!(Number(s.price) > 0)) return `${n}: enter price for size ${s.size}`;
    if (!(Number(s.mrp) > 0)) return `${n}: enter MRP for size ${s.size}`;
    if (Number(s.mrp) < Number(s.price)) return `${n}: ${mrpError(s.price)} (size ${s.size})`;
    if (s.prepaid && Number(s.prepaid) >= Number(s.price)) return `${n}: prepaid discount must be less than the price (${s.size})`;
    if (s.stock.trim() === "" || Number(s.stock) < 0) return `${n}: enter inventory for size ${s.size}`;
    if (s.wdrp && Number(s.wdrp) > Number(s.price)) return `${n}: wrong/defective returns price can't exceed the price (${s.size})`;
  }
  for (const a of attrs) if (a.required && !p.attributes[a.key]?.trim()) return `${n}: ${a.label} is required`;
  for (const f of LEGAL_FIELDS) if (f.required && !p.legal[f.key]?.trim()) return `${n}: ${f.label} is required`;
  return null;
}

function AddSingleCatalogPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const draftParam = params.get("draft");
  const { byId } = useCategoryTree();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [draftId, setDraftId] = React.useState<string | null>(draftParam);
  /** Opened from Price Lock: also apply for Price Lock when sent for QC. */
  const [priceLock, setPriceLock] = React.useState(params.get("priceLock") === "1");
  const [products, setProducts] = React.useState<ProductForm[]>([]);
  const [active, setActive] = React.useState(0);
  const [saving, setSaving] = React.useState<"draft" | "submit" | null>(null);
  /** Meesho-style: a price typed in one size row fills every size row. */
  const [copyPrices, setCopyPrices] = React.useState(true);
  /** Product details typed once apply to every product in the catalog (colour stays per product). */
  const [sameDetails, setSameDetails] = React.useState(true);
  /** After a submit attempt, empty required fields are shown in red too. */
  const [attempted, setAttempted] = React.useState(false);
  const { upload, uploading } = useImageKitUpload("/catalogs");
  const firstImagesRef = React.useRef<HTMLInputElement>(null);
  const { data: calc } = useSWR("seller-calc-terms", () => sellerCenter.calculator(100), { revalidateOnFocus: false });

  // Resume a draft.
  React.useEffect(() => {
    if (!draftParam) return;
    supplier
      .draft(draftParam)
      .then((d) => {
        setCategoryId(d.categoryId);
        const list = (d.draft?.products ?? []) as ProductForm[];
        if (list.length && Array.isArray(list[0]?.sizes)) {
          setProducts(list.map((p) => ({ ...emptyProduct(), ...p, images: [...(p.images ?? []), null, null, null, null, null].slice(0, 5) })));
          setStep(2);
        }
      })
      .catch((err) => toast.error(errorMessage(err, "Could not open the draft")));
  }, [draftParam]);

  const path = categoryId ? (byId.get(categoryId)?.path ?? []) : [];
  const pathNames = path.map((n) => n.name);
  /** Example set by KTMONA for this category (or its nearest parent). */
  const exampleImage = [...path].reverse().find((n) => n.image)?.image ?? null;
  // Fields the admin set for this category (Category Builder); built-in ones otherwise.
  const { data: remoteFields } = useSWR(categoryId ? ["category-fields", categoryId] : null, () => categoryFieldsApi.resolve(categoryId!), { revalidateOnFocus: false });
  const attrs = React.useMemo<AttributeDef[]>(
    () =>
      remoteFields?.fields
        ? remoteFields.fields.map((f) => ({
            key: f.key ?? f.label,
            label: f.label,
            required: f.required,
            ...(f.type === "SELECT" ? { options: f.options } : {}),
            ...(f.placeholder ? { placeholder: f.placeholder } : {}),
            ...(f.type === "NUMBER" ? { numeric: true } : {}),
          }))
        : attributesFor(pathNames),
    [remoteFields, pathNames.join("/")] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const presets = React.useMemo(() => sizePresetsFor(pathNames), [pathNames.join("/")]); // eslint-disable-line react-hooks/exhaustive-deps

  const earn = (price: string) => {
    const p = Number(price);
    if (!calc || !(p > 0)) return null;
    return Math.max(0, p - (p * calc.commissionPct) / 100 - calc.platformFee);
  };

  const startWithImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_PRODUCTS - products.length);
    try {
      const urls: string[] = [];
      for (const f of list) urls.push(await upload(f));
      setProducts((prev) => [...prev, ...urls.map((u) => emptyProduct(u))]);
      setActive(products.length);
      setStep(2);
    } catch (err) {
      toast.error(errorMessage(err, "Image upload failed"));
    }
  };

  const update = (patch: Partial<ProductForm>) => setProducts((prev) => prev.map((p, i) => (i === active ? { ...p, ...patch } : p)));
  const shareDetails = sameDetails && products.length > 1;
  /** One product-detail field; with "same details" on it is written to every product. */
  const setAttr = (key: string, value: string) =>
    setProducts((prev) => prev.map((x, i) => (i === active || (shareDetails && key !== "Color") ? { ...x, attributes: { ...x.attributes, [key]: value } } : x)));
  const setLegal = (key: string, value: string) =>
    setProducts((prev) => prev.map((x, i) => (i === active || shareDetails ? { ...x, legal: { ...x.legal, [key]: value } } : x)));
  const setShared = (patch: Partial<Pick<ProductForm, "netWeight" | "hsnCode" | "gst" | "description">>) =>
    setProducts((prev) => prev.map((x, i) => (i === active || shareDetails ? { ...x, ...patch } : x)));
  const p = products[active];

  const copyToAll = () => {
    if (!p) return;
    setProducts((prev) =>
      prev.map((x, i) =>
        i === active ? x : { ...x, attributes: { ...p.attributes, Color: x.attributes.Color ?? "" }, legal: { ...p.legal }, netWeight: p.netWeight, hsnCode: p.hsnCode, gst: p.gst, description: x.description || p.description, sizes: p.sizes.map((s) => ({ ...s, sku: "" })) }
      )
    );
    toast.success("Details, sizes and prices copied to all products (colour kept per product)");
  };

  const saveDraft = async () => {
    if (!categoryId) return;
    setSaving("draft");
    try {
      const res = await supplier.saveDraft({ id: draftId ?? undefined, categoryId, products });
      setDraftId(res.id);
      toast.success("Saved as draft");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const submit = async () => {
    if (!categoryId) return;
    setAttempted(true);
    for (const [i, prod] of products.entries()) {
      const msg = validate(prod, attrs, i);
      if (msg) {
        setActive(i);
        toast.error(msg);
        return;
      }
    }
    setSaving("submit");
    try {
      const res = await supplier.submitSingle({ draftId: draftId ?? undefined, categoryId, products: products.map(toPayload), priceLock });
      toast.success(
        priceLock
          ? `${res.productsCreated} product(s) sent for QC and Price Lock review. File ID ${res.fileId}`
          : `${res.productsCreated} product(s) sent for QC. File ID ${res.fileId}`
      );
      res.errors.forEach((e) => toast.error(`Product ${e.row}: ${e.message}`));
      router.push(priceLock ? "/seller/price-lock" : "/seller/catalog-uploads?mode=single");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const discard = async () => {
    if (draftId) await supplier.deleteDraft(draftId).catch(() => undefined);
    router.push("/seller/catalog-uploads?mode=single");
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      <div className="border-b border-border-soft bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/seller/catalog-uploads" className="inline-flex items-center gap-2 text-lg font-semibold">
            <ArrowLeft className="h-5 w-5" /> Add Single Catalog
          </Link>
          <ol className="flex items-center gap-4 text-sm">
            {["Select Category", "Add Product Details"].map((label, i) => (
              <li key={label} className={cn("flex items-center gap-2", step === i + 1 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs", step > i + 1 ? "bg-emerald-600 text-white" : step === i + 1 ? "bg-ink text-paper dark:bg-brand dark:text-ink" : "bg-mist")}>
                  {step > i + 1 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
          <Link href="/seller/support?topic=catalog" className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <Headset className="h-4 w-4" /> Need Help?
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8">
        {step === 1 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <CategoryColumns value={categoryId} onChange={setCategoryId} />
            {categoryId ? (
              <aside className="h-fit rounded-2xl border border-border-soft bg-card">
                <p className="border-b border-border-soft bg-mist/60 px-4 py-3 text-xs text-muted-foreground">{categoryPathLabel(path)}</p>
                <div className="space-y-4 p-4">
                  {exampleImage ? (
                    <img src={exampleImage} alt={`Example: ${pathNames[pathNames.length - 1] ?? "product"}`} className="mx-auto h-56 w-auto max-w-full rounded-lg object-contain" />
                  ) : null}
                  <p className="text-center text-sm font-semibold">Please provide only front image for each product</p>
                  <Btn variant="primary" className="w-full" loading={uploading} onClick={() => firstImagesRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Add Product Images
                  </Btn>
                  <input ref={firstImagesRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void startWithImages(e.target.files); e.target.value = ""; }} />
                  {products.length ? (
                    <Btn variant="outline" className="w-full" onClick={() => setStep(2)}>
                      Continue with {products.length} product(s)
                    </Btn>
                  ) : null}
                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Follow guidelines to reduce quality check failure
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold">General Guidelines</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                      <li>You can add minimum 1 and maximum {MAX_PRODUCTS} products to create a catalog.</li>
                      <li>Upload products from the same category that you have chosen.</li>
                    </ol>
                    <p className="mt-3 font-semibold">Image Guidelines</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                      <li>Images with text/watermark are not acceptable in primary images.</li>
                      <li>Product image should not have any text.</li>
                      <li>Add a solo product image without any props.</li>
                    </ol>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        ) : p ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {products.map((x, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActive(i)}
                    className={cn("relative h-16 w-16 overflow-hidden rounded-lg border-2", i === active ? "border-brand" : "border-border-soft")}
                    aria-label={`Product ${i + 1}`}
                  >
                    {x.images[0] ? (
                      <img src={x.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{i + 1}</span>
                    )}
                    <span className="absolute bottom-0 left-0 rounded-tr bg-ink/75 px-1 text-[10px] text-white">{i + 1}</span>
                  </button>
                ))}
                {products.length < MAX_PRODUCTS ? (
                  <button type="button" onClick={() => firstImagesRef.current?.click()} className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-border-strong text-[11px] text-muted-foreground hover:border-brand">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
                  </button>
                ) : null}
                <input ref={firstImagesRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void startWithImages(e.target.files); e.target.value = ""; }} />
                <div className="ml-auto flex gap-2">
                  {products.length > 1 ? (
                    <Btn size="sm" variant="outline" onClick={copyToAll}>
                      <Copy className="h-3.5 w-3.5" /> Copy details to all
                    </Btn>
                  ) : null}
                  <Btn
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setProducts((prev) => prev.filter((_, i) => i !== active));
                      setActive(Math.max(0, active - 1));
                      if (products.length === 1) setStep(1);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Btn>
                </div>
              </div>

              <section className="rounded-2xl border border-border-soft bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="h-12 w-12 overflow-hidden rounded-lg bg-mist">
                    {p.images[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name || `Product ${active + 1}`}</p>
                    <p className="text-xs text-muted-foreground">{categoryPathLabel(path)}</p>
                  </div>
                </div>

                <h2 className="mt-6 text-base font-semibold">Product Details</h2>
                <p className="mt-4 text-sm font-semibold text-muted-foreground">Price, Size and Inventory</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Net Weight (gms) *" error={attempted && !(Number(p.netWeight) > 0) ? "Enter net weight in grams" : undefined}>
                    <input className={inputCls} inputMode="numeric" value={p.netWeight} onChange={(e) => setShared({ netWeight: e.target.value.replace(/[^\d]/g, "") })} />
                  </Field>
                  <Field label="Style code / Product ID (optional)">
                    <input className={inputCls} value={p.styleCode} onChange={(e) => update({ styleCode: e.target.value })} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Product Name *" error={attempted && p.name.trim().length < 3 ? "Enter a product name" : undefined}>
                      <input className={inputCls} maxLength={255} value={p.name} onChange={(e) => update({ name: e.target.value })} />
                    </Field>
                  </div>
                </div>

                <p className="mt-5 text-sm font-medium">Size *</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {presets.map((size) => {
                    const on = p.sizes.some((s) => s.size === size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() =>
                          update({
                            sizes: on
                              ? p.sizes.filter((s) => s.size !== size)
                              : [...p.sizes, { size, price: p.sizes[0]?.price ?? "", wdrp: p.sizes[0]?.wdrp ?? "", prepaid: p.sizes[0]?.prepaid ?? "", mrp: p.sizes[0]?.mrp ?? "", stock: p.sizes[0]?.stock ?? "", sku: "" }],
                          })
                        }
                        className={cn("rounded-lg border px-3 py-1.5 text-sm", on ? "border-brand bg-brand/10 font-semibold" : "border-border-soft hover:bg-mist")}
                      >
                        {size}
                      </button>
                    );
                  })}
                  {/* Sizes typed in by the seller: shown as chips so they can be removed. */}
                  {p.sizes
                    .filter((s) => !presets.includes(s.size))
                    .map((s) => (
                      <span key={s.size} className="inline-flex items-center gap-1 rounded-lg border border-brand bg-brand/10 py-1.5 pl-3 pr-1.5 text-sm font-semibold">
                        {s.size}
                        <button
                          type="button"
                          aria-label={`Remove size ${s.size}`}
                          className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-red-600"
                          onClick={() => update({ sizes: p.sizes.filter((x) => x.size !== s.size) })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  <CustomSize onAdd={(size) => !p.sizes.some((s) => s.size === size) && update({ sizes: [...p.sizes, { size, price: "", wdrp: "", prepaid: "", mrp: "", stock: "", sku: "" }] })} />
                </div>

                {p.sizes.length > 1 ? (
                  <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={copyPrices}
                      onChange={(e) => {
                        setCopyPrices(e.target.checked);
                        // Turning it on lines every size up with the first one.
                        if (e.target.checked && p.sizes[0]) {
                          const first = p.sizes[0];
                          update({ sizes: p.sizes.map((x) => ({ ...x, price: first.price, wdrp: first.wdrp, prepaid: first.prepaid, mrp: first.mrp, stock: first.stock })) });
                        }
                      }}
                    />
                    Copy price details to all sizes
                  </label>
                ) : null}
                {p.sizes.length ? (
                  <div className="mt-3 overflow-x-auto rounded-xl border border-border-soft">
                    <table className="w-full min-w-[860px] text-left text-sm">
                      <thead>
                        <tr className="bg-mist/60 text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-semibold">Size</th>
                          <th className="px-2 py-2 font-semibold">Your Price *</th>
                          <th className="px-2 py-2 font-semibold">Wrong/Defective Returns Price</th>
                          <th className="px-2 py-2 font-semibold">Prepaid Discount</th>
                          <th className="px-2 py-2 font-semibold">MRP *</th>
                          <th className="px-2 py-2 font-semibold">Inventory *</th>
                          <th className="px-2 py-2 font-semibold">SKU ID (optional)</th>
                          <th className="w-10 px-2 py-2"><span className="sr-only">Remove</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.sizes.map((s, idx) => {
                          // Price columns follow the edited row in every size while "copy" is on (SKU never).
                          const set = (patch: Partial<SizeRow>) =>
                            update({
                              sizes: p.sizes.map((x, j) =>
                                j === idx ? { ...x, ...patch } : copyPrices && Object.keys(patch).every((k) => PRICE_KEYS.includes(k as keyof SizeRow)) ? { ...x, ...patch } : x
                              ),
                            });
                          const errors = sizeRowErrors(s, attempted);
                          const cell = (key: keyof SizeRow, rupee = true) => (
                            <div className="relative">
                              {rupee ? <span className="pointer-events-none absolute left-2 top-[18px] -translate-y-1/2 text-xs text-muted-foreground">₹</span> : null}
                              <input
                                className={cn(inputCls, "h-9", rupee && "pl-5", errors[key] && "border-red-500 focus:border-red-500 focus:ring-red-500/20")}
                                aria-invalid={Boolean(errors[key])}
                                inputMode={key === "sku" ? "text" : "decimal"}
                                value={s[key]}
                                onChange={(e) => set({ [key]: key === "sku" ? e.target.value : e.target.value.replace(/[^\d.]/g, "") } as Partial<SizeRow>)}
                                aria-label={`${key} for size ${s.size}`}
                              />
                              {errors[key] ? <p className="mt-1 max-w-[180px] text-[11px] font-medium leading-snug text-red-600">{errors[key]}</p> : null}
                            </div>
                          );
                          const discount = discountLabel(s);
                          const net = earn(s.price);
                          return (
                            <tr key={s.size} className="border-t border-border-soft align-top">
                              <td className="px-3 py-2 font-semibold">{s.size}</td>
                              <td className="px-2 py-2">
                                {cell("price")}
                                {net != null ? <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">You earn {inr2.format(net)}</p> : null}
                              </td>
                              <td className="px-2 py-2">{cell("wdrp")}</td>
                              <td className="px-2 py-2">{cell("prepaid")}</td>
                              <td className="px-2 py-2">
                                {cell("mrp")}
                                {discount && !errors.mrp ? <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">{discount}</p> : null}
                              </td>
                              <td className="px-2 py-2">{cell("stock", false)}</td>
                              <td className="px-2 py-2">{cell("sku", false)}</td>
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  aria-label={`Remove size ${s.size}`}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-mist hover:text-red-600"
                                  onClick={() => update({ sizes: p.sizes.filter((x) => x.size !== s.size) })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-muted-foreground">Product Details</p>
                  {products.length > 1 ? (
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <input type="checkbox" className="h-4 w-4 accent-brand" checked={sameDetails} onChange={(e) => setSameDetails(e.target.checked)} />
                      Same details for all {products.length} products (colour stays per product)
                    </label>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {attrs.map((a) => (
                    <AttrInput key={`${active}-${a.key}`} def={a} value={p.attributes[a.key] ?? ""} onChange={(v) => setAttr(a.key, v)} error={attempted && a.required && !p.attributes[a.key]?.trim()} />
                  ))}
                  {LEGAL_FIELDS.map((a) => (
                    <AttrInput key={`${active}-${a.key}`} def={a} value={p.legal[a.key] ?? ""} onChange={(v) => setLegal(a.key, v)} error={attempted && a.required && !p.legal[a.key]?.trim()} />
                  ))}
                </div>

                <p className="mt-6 text-sm font-semibold text-muted-foreground">Other Attributes</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="HSN Code">
                    <input className={inputCls} value={p.hsnCode} onChange={(e) => setShared({ hsnCode: e.target.value })} />
                  </Field>
                  <Field label="GST %">
                    <select className={inputCls} value={p.gst} onChange={(e) => setShared({ gst: e.target.value })}>
                      {["0", "3", "5", "12", "18", "28"].map((g) => (
                        <option key={g} value={g}>{g}%</option>
                      ))}
                    </select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Description" hint={`${p.description.length}/2000`}>
                      <textarea className={cn(inputCls, "h-28 py-2")} maxLength={2000} value={p.description} onChange={(e) => update({ description: e.target.value })} />
                    </Field>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Follow guidelines to reduce quality check failure
              </div>
              <div className="rounded-2xl border border-border-soft bg-card p-4">
                <p className="text-sm font-semibold">Add images with details listed here</p>
                <div className="mt-3 space-y-3">
                  {IMAGE_SLOTS.map((slot, i) => (
                    <ImageSlot
                      key={slot.key}
                      label={`${slot.label}${slot.required ? " *" : ""}`}
                      hint={slot.hint}
                      url={p.images[i] ?? null}
                      onChange={(url) => update({ images: p.images.map((x, j) => (j === i ? url : x)) })}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border-soft bg-card p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
                  <Ban className="h-4 w-4" /> Image types which are not allowed
                </p>
                <ul className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  {NOT_ALLOWED_IMAGES.map((t) => (
                    <li key={t}>• {t}</li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-soft bg-card/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <Btn variant="outline" onClick={discard}>
            Discard Catalog
          </Btn>
          {step === 2 ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="mr-2 inline-flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={priceLock} onChange={(e) => setPriceLock(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
                Apply for KTMONA Price Lock
              </label>
              <Btn variant="outline" onClick={() => setStep(1)}>Back</Btn>
              <Btn variant="outline" loading={saving === "draft"} onClick={saveDraft}>
                Save Draft
              </Btn>
              <Btn variant="primary" loading={saving === "submit"} onClick={submit}>
                Submit Catalog
              </Btn>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CustomSize({ onAdd }: { onAdd: (size: string) => void }) {
  const [value, setValue] = React.useState("");
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            e.preventDefault();
            onAdd(value.trim());
            setValue("");
          }
        }}
        placeholder="Other size"
        className="h-9 w-28 rounded-lg border border-border-soft bg-card px-2 text-sm"
        aria-label="Add a custom size"
      />
      <Btn size="sm" variant="ghost" disabled={!value.trim()} onClick={() => { onAdd(value.trim()); setValue(""); }}>
        Add
      </Btn>
    </span>
  );
}

const OTHER = "__other__";

/**
 * A product-detail field. Drop-downs also take the seller's own value
 * ("+ Add your own"), because colours, styles and patterns are endless.
 */
function AttrInput({ def, value, onChange, error }: { def: AttributeDef; value: string; onChange: (v: string) => void; error?: boolean }) {
  const label = `${def.label}${def.required ? " *" : ""}`;
  const isCustom = Boolean(def.options && value && !def.options.includes(value));
  const [typing, setTyping] = React.useState(isCustom);
  const message = error ? `${def.label} is required` : undefined;
  const errorCls = error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "";

  if (def.options && !typing && !isCustom) {
    return (
      <Field label={label} error={message}>
        <select
          className={cn(inputCls, errorCls)}
          value={value}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setTyping(true);
              onChange("");
            } else onChange(e.target.value);
          }}
        >
          <option value="">Select</option>
          {def.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
          <option value={OTHER}>+ Add your own…</option>
        </select>
      </Field>
    );
  }

  return (
    <Field label={label} error={message}>
      <div className="flex gap-2">
        <input
          className={cn(inputCls, errorCls)}
          value={value}
          autoFocus={typing && !value}
          aria-invalid={Boolean(error)}
          placeholder={def.options ? `Type your ${def.label.toLowerCase()}` : def.placeholder}
          inputMode={def.numeric ? "decimal" : undefined}
          onChange={(e) => onChange(def.numeric ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)}
        />
        {def.options ? (
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-brand-strong hover:underline"
            onClick={() => {
              setTyping(false);
              onChange("");
            }}
          >
            Choose from list
          </button>
        ) : null}
      </div>
    </Field>
  );
}

function ImageSlot({ label, hint, url, onChange }: { label: string; hint: string; url: string | null; onChange: (url: string | null) => void }) {
  const { upload, uploading } = useImageKitUpload("/catalogs");
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-mist/40 hover:border-brand"
        aria-label={`Upload ${label}`}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {url ? (
        <button type="button" onClick={() => onChange(null)} className="rounded-md p-1 text-muted-foreground hover:bg-mist" aria-label={`Remove ${label}`}>
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            onChange(await upload(f));
          } catch (err) {
            toast.error(errorMessage(err, "Upload failed"));
          }
        }}
      />
    </div>
  );
}

/** Sellers can list products only after KTMONA verifies their KYC. */
export default function AddSingleCatalogPage() {
  return (
    <KycGate>
      <AddSingleCatalogPageContent />
    </KycGate>
  );
}
