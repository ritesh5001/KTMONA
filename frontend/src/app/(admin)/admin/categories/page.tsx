"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import ImageKit from "imagekit-javascript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
  toggleAdminCategory,
  type AdminCategory,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
} from "@/services/admin";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { compressImageForUpload } from "@/lib/image-compression";

const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const getMissingImageKitConfig = () => {
  const missing: string[] = [];
  if (!IMAGEKIT_PUBLIC_KEY) missing.push("NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY");
  if (!IMAGEKIT_URL_ENDPOINT) missing.push("NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT");
  if (!API_BASE_URL) missing.push("NEXT_PUBLIC_API_BASE_URL");
  return missing;
};

const emptyForm: CreateCategoryPayload = {
  name: "",
  description: "",
  image: "",
  bannerImage: "",
  parentId: undefined,
  sortOrder: 0,
  seoTitle: "",
  seoDescription: "",
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Shared form fields component
const CategoryFormFields = ({
  values,
  onChange,
  parentOptions,
  excludeId,
  onUpload,
  uploadingImage,
  uploadingBannerImage,
}: {
  values: Record<string, any>;
  onChange: (field: string, value: any) => void;
  parentOptions: AdminCategory[];
  excludeId?: string;
  onUpload: (field: "image" | "bannerImage", file: File) => void;
  uploadingImage: boolean;
  uploadingBannerImage: boolean;
}) => (
  <div className="space-y-4">
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Name</Label>
      <Input value={values.name ?? ""} onChange={(e) => onChange("name", e.target.value)} className="mt-1 h-11" placeholder="Category name" />
    </div>
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
      <Textarea value={values.description ?? ""} onChange={(e) => onChange("description", e.target.value)} className="mt-1" rows={3} placeholder="Brief description..." />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category Image</Label>
        <div className="mt-1 space-y-2">
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload("image", file);
              event.currentTarget.value = "";
            }}
            className="h-11"
          />
          {uploadingImage && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
            </p>
          )}
          {values.image ? (
            <div className="space-y-2">
              <div className="relative h-24 w-full overflow-hidden border border-border-soft">
                <Image
                  src={values.image}
                  alt="Category"
                  fill
                  sizes="(max-width: 768px) 100vw, 24rem"
                  className="object-cover"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onChange("image", "")}>Remove Image</Button>
            </div>
          ) : null}
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Banner Image</Label>
        <div className="mt-1 space-y-2">
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload("bannerImage", file);
              event.currentTarget.value = "";
            }}
            className="h-11"
          />
          {uploadingBannerImage && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
            </p>
          )}
          {values.bannerImage ? (
            <div className="space-y-2">
              <div className="relative h-24 w-full overflow-hidden border border-border-soft">
                <Image
                  src={values.bannerImage}
                  alt="Category banner"
                  fill
                  sizes="(max-width: 768px) 100vw, 24rem"
                  className="object-cover"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onChange("bannerImage", "")}>Remove Banner</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Parent Category</Label>
        <select
          value={values.parentId ?? ""}
          onChange={(e) => onChange("parentId", e.target.value || undefined)}
          className="mt-1 flex h-11 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">None (Top Level)</option>
          {parentOptions
            .filter((c) => c.id !== excludeId)
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sort Order</Label>
        <Input type="number" value={values.sortOrder ?? 0} onChange={(e) => onChange("sortOrder", Number(e.target.value))} className="mt-1 h-11" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">SEO Title</Label>
        <Input value={values.seoTitle ?? ""} onChange={(e) => onChange("seoTitle", e.target.value)} className="mt-1 h-11" placeholder="SEO page title" />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">SEO Description</Label>
        <Input value={values.seoDescription ?? ""} onChange={(e) => onChange("seoDescription", e.target.value)} className="mt-1 h-11" placeholder="Meta description" />
      </div>
    </div>
  </div>
);

export default function AdminCategoriesPage() {
  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<AdminCategory[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [pendingCategoryIds, setPendingCategoryIds] = React.useState<string[]>([]);

  // Create modal
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<CreateCategoryPayload>({ ...emptyForm });
  const [uploadingCreateImage, setUploadingCreateImage] = React.useState(false);
  const [uploadingCreateBannerImage, setUploadingCreateBannerImage] = React.useState(false);

  // Edit modal
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<UpdateCategoryPayload>({});
  const [uploadingEditImage, setUploadingEditImage] = React.useState(false);
  const [uploadingEditBannerImage, setUploadingEditBannerImage] = React.useState(false);

  const imagekit = React.useMemo(() => {
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_URL_ENDPOINT || !API_BASE_URL) {
      return null;
    }
    return new ImageKit({
      publicKey: IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    });
  }, []);

  const setCategoryPending = React.useCallback((id: string, pending: boolean) => {
    setPendingCategoryIds((prev) => {
      if (pending) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((value) => value !== id);
    });
  }, []);

  const buildCategoryPreview = React.useCallback(
    (
      payload: CreateCategoryPayload | UpdateCategoryPayload,
      current?: AdminCategory,
      overrides?: Partial<AdminCategory>
    ): AdminCategory => {
      const nextName = payload.name?.trim() || current?.name || "";

      return {
        id: overrides?.id ?? current?.id ?? `temp-category-${Date.now()}`,
        name: nextName,
        slug: slugify(nextName),
        description:
          payload.description === undefined
            ? current?.description ?? null
            : payload.description || null,
        image: payload.image === undefined ? current?.image ?? null : payload.image || null,
        bannerImage:
          payload.bannerImage === undefined
            ? current?.bannerImage ?? null
            : payload.bannerImage || null,
        parentId:
          payload.parentId === undefined
            ? current?.parentId ?? null
            : payload.parentId || null,
        sortOrder: payload.sortOrder ?? current?.sortOrder ?? 0,
        seoTitle:
          payload.seoTitle === undefined ? current?.seoTitle ?? null : payload.seoTitle || null,
        seoDescription:
          payload.seoDescription === undefined
            ? current?.seoDescription ?? null
            : payload.seoDescription || null,
        isActive: overrides?.isActive ?? current?.isActive ?? true,
        createdAt: overrides?.createdAt ?? current?.createdAt ?? new Date().toISOString(),
      };
    },
    []
  );

  const uploadCategoryAsset = React.useCallback(
    async ({
      file,
      field,
      mode,
    }: {
      file: File;
      field: "image" | "bannerImage";
      mode: "create" | "edit";
    }) => {
      if (!imagekit) {
        const missing = getMissingImageKitConfig();
        toast.error(
          missing.length
            ? `Missing env: ${missing.join(", ")}`
            : "ImageKit is not configured."
        );
        return;
      }

      const setUploading = (value: boolean) => {
        if (mode === "create") {
          if (field === "image") setUploadingCreateImage(value);
          else setUploadingCreateBannerImage(value);
          return;
        }
        if (field === "image") setUploadingEditImage(value);
        else setUploadingEditBannerImage(value);
      };

      try {
        setUploading(true);
        const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
        if (!authResponse.ok) {
          const authData = await authResponse.json().catch(() => null);
          const authMessage = authData?.message ?? "ImageKit auth failed.";
          toast.error(authMessage);
          return;
        }

        const authData = (await authResponse.json()) as {
          signature: string;
          token: string;
          expire: number;
        };

        const compressedFile = await compressImageForUpload(file);
        const result = await imagekit.upload({
          file: compressedFile,
          fileName: compressedFile.name,
          folder: "/ktmona/categories",
          useUniqueFileName: true,
          signature: authData.signature,
          token: authData.token,
          expire: authData.expire,
        });

        if (mode === "create") {
          setCreateForm((prev) => ({ ...prev, [field]: result.url }));
        } else {
          setEditForm((prev) => ({ ...prev, [field]: result.url }));
        }

        toast.success(`${field === "image" ? "Category" : "Banner"} image uploaded.`);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : (error as any)?.response?.data?.message ??
            (error as any)?.response?.message ??
            (error as any)?.message ??
            "Image upload failed";
        toast.error(message);
      } finally {
        setUploading(false);
      }
    },
    [imagekit]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminCategories();
      setCategories(result.categories ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!createForm.name?.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    const previousForm = { ...createForm };
    const tempId = `temp-category-${Date.now()}`;
    try {
      const payload: CreateCategoryPayload = {
        ...createForm,
        name: createForm.name.trim(),
        description: createForm.description?.trim() || undefined,
        image: createForm.image?.trim() || undefined,
        bannerImage: createForm.bannerImage?.trim() || undefined,
        parentId: createForm.parentId || undefined,
        seoTitle: createForm.seoTitle?.trim() || undefined,
        seoDescription: createForm.seoDescription?.trim() || undefined,
      };
      setCreateForm({ ...emptyForm });
      setShowCreate(false);
      setCategories((prev) => [
        buildCategoryPreview(payload, undefined, { id: tempId, isActive: true }),
        ...prev,
      ]);
      const result = await createAdminCategory(payload);
      setCategories((prev) =>
        prev.map((category) => (category.id === tempId ? result.category : category))
      );
      toast.success("Category created.");
    } catch (error) {
      setCategories((prev) => prev.filter((category) => category.id !== tempId));
      setCreateForm(previousForm);
      setShowCreate(true);
      toast.error(error instanceof Error ? error.message : "Unable to create category");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (cat: AdminCategory) => {
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      description: cat.description ?? "",
      image: cat.image ?? "",
      bannerImage: cat.bannerImage ?? "",
      parentId: cat.parentId ?? undefined,
      sortOrder: cat.sortOrder ?? 0,
      seoTitle: cat.seoTitle ?? "",
      seoDescription: cat.seoDescription ?? "",
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const existingCategory = categories.find((category) => category.id === editingId);
    if (!existingCategory) return;

    setSaving(true);
    const categoryId = editingId;
    const previousForm = { ...editForm };
    try {
      const payload: UpdateCategoryPayload = {
        ...editForm,
        name: editForm.name?.trim() || undefined,
        description:
          editForm.description === undefined
            ? undefined
            : editForm.description?.trim() || null,
        image: editForm.image === undefined ? undefined : editForm.image?.trim() || null,
        bannerImage:
          editForm.bannerImage === undefined
            ? undefined
            : editForm.bannerImage?.trim() || null,
        parentId: editForm.parentId === undefined ? undefined : editForm.parentId || null,
        seoTitle:
          editForm.seoTitle === undefined ? undefined : editForm.seoTitle?.trim() || null,
        seoDescription:
          editForm.seoDescription === undefined
            ? undefined
            : editForm.seoDescription?.trim() || null,
      };
      setCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId
            ? buildCategoryPreview(payload, category)
            : category
        )
      );
      setEditingId(null);
      const result = await updateAdminCategory(categoryId, payload);
      setCategories((prev) =>
        prev.map((category) => (category.id === categoryId ? result.category : category))
      );
      toast.success("Category updated.");
    } catch (error) {
      setCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId ? existingCategory : category
        )
      );
      setEditingId(categoryId);
      setEditForm(previousForm);
      toast.error(error instanceof Error ? error.message : "Unable to update category");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    const currentCategory = categories.find((category) => category.id === id);
    if (!currentCategory) return;

    setCategoryPending(id, true);
    setCategories((prev) =>
      prev.map((category) =>
        category.id === id ? { ...category, isActive: !category.isActive } : category
      )
    );

    try {
      const result = await toggleAdminCategory(id);
      setCategories((prev) =>
        prev.map((category) => (category.id === id ? result.category : category))
      );
      toast.success(result.category.isActive ? "Category is now visible." : "Category hidden from storefront, seller panel & app.");
    } catch (error) {
      setCategories((prev) =>
        prev.map((category) =>
          category.id === id ? currentCategory : category
        )
      );
      toast.error(error instanceof Error ? error.message : "Unable to toggle category");
    } finally {
      setCategoryPending(id, false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? This cannot be undone.")) return;

    const categoryIndex = categories.findIndex((category) => category.id === id);
    const categoryToDelete = categories[categoryIndex];
    if (!categoryToDelete) return;

    setCategoryPending(id, true);
    setCategories((prev) => prev.filter((category) => category.id !== id));

    try {
      await deleteAdminCategory(id);
      toast.success("Category deleted.");
    } catch (error) {
      setCategories((prev) => {
        if (prev.some((category) => category.id === categoryToDelete.id)) {
          return prev;
        }
        const next = [...prev];
        next.splice(Math.min(categoryIndex, next.length), 0, categoryToDelete);
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Unable to delete category");
    } finally {
      setCategoryPending(id, false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16 lg:py-20"
      >
        <div className="flex items-end justify-between">
          <div className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">Catalog Settings</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Category Management</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Create and edit categories. Hiding a category removes it from the storefront, seller panel, and mobile app (its products stay visible). Show it again anytime.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="h-11 px-6">+ New Category</Button>
        </div>

        {/* Category list */}
        <div className="border border-border-soft bg-card">
          <div className="border-b border-border-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">Catalog</p>
                <p className="font-serif text-lg font-light text-foreground">All Categories</p>
              </div>
              <p className="text-sm text-muted-foreground">{categories.length} total</p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Loading categories...</p></div>
          ) : categories.length === 0 ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">No categories yet.</p></div>
          ) : (
            <div className="divide-y divide-border-soft">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={`flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between ${
                    pendingCategoryIds.includes(category.id) ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.slug}
                      {category.description ? ` · ${category.description.slice(0, 60)}...` : ""}
                      {category.parentId ? ` · Child of ${categories.find((c) => c.id === category.parentId)?.name ?? "..."}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {pendingCategoryIds.includes(category.id) ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 text-[10px] uppercase tracking-wider border border-brand/30 bg-brand/5 text-[#B84A00]">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Updating
                      </span>
                    ) : null}
                    <span className={`px-3 py-1 text-[10px] uppercase tracking-wider border ${category.isActive ? "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5" : "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5"}`}>
                      {category.isActive ? "Visible" : "Hidden"}
                    </span>
                    <Button size="sm" variant="outline" disabled={pendingCategoryIds.includes(category.id)} onClick={() => openEdit(category)}>Edit</Button>
                    <Button size="sm" variant="outline" disabled={pendingCategoryIds.includes(category.id)} className={category.isActive ? "border-[#A67575]/40 text-[#7A5656]" : "border-[#7B9971]/40 text-[#5A7352]"} onClick={() => handleToggle(category.id)}>
                      {category.isActive ? "Hide" : "Show"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={pendingCategoryIds.includes(category.id)} className="border-red-300/40 text-red-600" onClick={() => handleDelete(category.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border-soft bg-card p-6 shadow-xl">
              <button onClick={() => setShowCreate(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              <h2 className="text-xl font-semibold text-foreground mb-6">New Category</h2>
              <CategoryFormFields
                values={createForm}
                onChange={(field, value) => setCreateForm((prev) => ({ ...prev, [field]: value }))}
                parentOptions={categories}
                onUpload={(field, file) => uploadCategoryAsset({ file, field, mode: "create" })}
                uploadingImage={uploadingCreateImage}
                uploadingBannerImage={uploadingCreateBannerImage}
              />
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving || uploadingCreateImage || uploadingCreateBannerImage}>{saving ? "Saving..." : "Create"}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border-soft bg-card p-6 shadow-xl">
              <button onClick={() => setEditingId(null)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              <h2 className="text-xl font-semibold text-foreground mb-6">Edit Category</h2>
              <CategoryFormFields
                values={editForm}
                onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
                parentOptions={categories}
                excludeId={editingId}
                onUpload={(field, file) => uploadCategoryAsset({ file, field, mode: "edit" })}
                uploadingImage={uploadingEditImage}
                uploadingBannerImage={uploadingEditBannerImage}
              />
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={saving || uploadingEditImage || uploadingEditBannerImage}>{saving ? "Saving..." : "Update"}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
