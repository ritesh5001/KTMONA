"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import ImageKit from "imagekit-javascript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAdminOccasion,
  deleteAdminOccasion,
  getAdminOccasions,
  updateAdminOccasion,
  toggleAdminOccasion,
  type AdminOccasion,
  type CreateOccasionPayload,
  type UpdateOccasionPayload,
} from "@/services/admin";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { compressImageForUpload } from "@/lib/image-compression";

const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const emptyForm: CreateOccasionPayload = {
  name: "",
  image: "",
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const OccasionFormFields = ({
  values,
  onChange,
  onUpload,
  uploading,
}: {
  values: Record<string, any>;
  onChange: (field: string, value: any) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) => (
  <div className="space-y-4">
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Name</Label>
      <Input value={values.name ?? ""} onChange={(e) => onChange("name", e.target.value)} className="mt-1 h-11" placeholder="e.g. Diwali, Summer Sale, Back to School..." />
    </div>
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Occasion Image</Label>
      <div className="mt-1 space-y-2">
        <Input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.currentTarget.value = "";
          }}
          className="h-11"
        />
        {uploading && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
          </p>
        )}
        {values.image ? (
          <div className="space-y-2">
            <div className="relative h-24 w-full overflow-hidden border border-border-soft">
              <Image
                src={values.image}
                alt="Occasion"
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
  </div>
);

export default function AdminOccasionsPage() {
  const [loading, setLoading] = React.useState(true);
  const [occasions, setOccasions] = React.useState<AdminOccasion[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [pendingOccasionIds, setPendingOccasionIds] = React.useState<string[]>([]);

  // Create modal
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<CreateOccasionPayload>({ ...emptyForm });
  const [uploadingCreateImage, setUploadingCreateImage] = React.useState(false);

  // Edit modal
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<UpdateOccasionPayload>({});
  const [uploadingEditImage, setUploadingEditImage] = React.useState(false);

  const imagekit = React.useMemo(() => {
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_URL_ENDPOINT || !API_BASE_URL) return null;
    return new ImageKit({
      publicKey: IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    });
  }, []);

  const setOccasionPending = React.useCallback((id: string, pending: boolean) => {
    setPendingOccasionIds((prev) => {
      if (pending) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((value) => value !== id);
    });
  }, []);

  const buildOccasionPreview = React.useCallback(
    (
      payload: CreateOccasionPayload | UpdateOccasionPayload,
      current?: AdminOccasion,
      overrides?: Partial<AdminOccasion>
    ): AdminOccasion => {
      const nextName = payload.name?.trim() || current?.name || "";

      return {
        id: overrides?.id ?? current?.id ?? `temp-occasion-${Date.now()}`,
        name: nextName,
        slug: slugify(nextName),
        image: payload.image === undefined ? current?.image ?? null : payload.image || null,
        isActive: overrides?.isActive ?? current?.isActive ?? true,
        createdAt: overrides?.createdAt ?? current?.createdAt ?? new Date().toISOString(),
        updatedAt: overrides?.updatedAt ?? current?.updatedAt ?? new Date().toISOString(),
      };
    },
    []
  );

  const uploadOccasionImage = React.useCallback(
    async ({ file, mode }: { file: File; mode: "create" | "edit" }) => {
      if (!imagekit) {
        toast.error("ImageKit is not configured.");
        return;
      }

      const setUploading = mode === "create" ? setUploadingCreateImage : setUploadingEditImage;

      try {
        setUploading(true);
        const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
        if (!authResponse.ok) {
          toast.error("ImageKit auth failed.");
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
          folder: "/ktmona/occasions",
          useUniqueFileName: true,
          signature: authData.signature,
          token: authData.token,
          expire: authData.expire,
        });

        if (mode === "create") {
          setCreateForm((prev) => ({ ...prev, image: result.url }));
        } else {
          setEditForm((prev) => ({ ...prev, image: result.url }));
        }

        toast.success("Occasion image uploaded.");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Image upload failed";
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
      const result = await getAdminOccasions();
      setOccasions(result.occasions ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load occasions");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!createForm.name?.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    const previousForm = { ...createForm };
    const tempId = `temp-occasion-${Date.now()}`;
    try {
      const payload: CreateOccasionPayload = {
        name: createForm.name.trim(),
        image: createForm.image?.trim() || undefined,
      };

      setCreateForm({ ...emptyForm });
      setShowCreate(false);
      setOccasions((prev) => [
        buildOccasionPreview(payload, undefined, { id: tempId, isActive: true }),
        ...prev,
      ]);

      const result = await createAdminOccasion(payload);
      setOccasions((prev) =>
        prev.map((occasion) => (occasion.id === tempId ? result.occasion : occasion))
      );
      toast.success("Occasion created.");
    } catch (error) {
      setOccasions((prev) => prev.filter((occasion) => occasion.id !== tempId));
      setCreateForm(previousForm);
      setShowCreate(true);
      toast.error(error instanceof Error ? error.message : "Unable to create occasion");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (occ: AdminOccasion) => {
    setEditingId(occ.id);
    setEditForm({
      name: occ.name,
      image: occ.image ?? "",
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const existingOccasion = occasions.find((occasion) => occasion.id === editingId);
    if (!existingOccasion) return;

    setSaving(true);
    const occasionId = editingId;
    const previousForm = { ...editForm };
    try {
      const payload: UpdateOccasionPayload = {
        ...editForm,
        name: editForm.name?.trim() || undefined,
        image: editForm.image === undefined ? undefined : editForm.image?.trim() || null,
      };

      setOccasions((prev) =>
        prev.map((occasion) =>
          occasion.id === occasionId
            ? buildOccasionPreview(payload, occasion)
            : occasion
        )
      );
      setEditingId(null);

      const result = await updateAdminOccasion(occasionId, payload);
      setOccasions((prev) =>
        prev.map((occasion) => (occasion.id === occasionId ? result.occasion : occasion))
      );
      toast.success("Occasion updated.");
    } catch (error) {
      setOccasions((prev) =>
        prev.map((occasion) =>
          occasion.id === occasionId ? existingOccasion : occasion
        )
      );
      setEditingId(occasionId);
      setEditForm(previousForm);
      toast.error(error instanceof Error ? error.message : "Unable to update occasion");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    const currentOccasion = occasions.find((occasion) => occasion.id === id);
    if (!currentOccasion) return;

    setOccasionPending(id, true);
    setOccasions((prev) =>
      prev.map((occasion) =>
        occasion.id === id ? { ...occasion, isActive: !occasion.isActive } : occasion
      )
    );

    try {
      const result = await toggleAdminOccasion(id);
      setOccasions((prev) =>
        prev.map((occasion) => (occasion.id === id ? result.occasion : occasion))
      );
      toast.success(result.occasion.isActive ? "Occasion is now visible." : "Occasion hidden from storefront, seller panel & app.");
    } catch (error) {
      setOccasions((prev) =>
        prev.map((occasion) =>
          occasion.id === id ? currentOccasion : occasion
        )
      );
      toast.error(error instanceof Error ? error.message : "Unable to toggle occasion");
    } finally {
      setOccasionPending(id, false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this occasion? Products linked to it will be unlinked.")) return;

    const occasionIndex = occasions.findIndex((occasion) => occasion.id === id);
    const occasionToDelete = occasions[occasionIndex];
    if (!occasionToDelete) return;

    setOccasionPending(id, true);
    setOccasions((prev) => prev.filter((occasion) => occasion.id !== id));

    try {
      await deleteAdminOccasion(id);
      toast.success("Occasion deleted.");
    } catch (error) {
      setOccasions((prev) => {
        if (prev.some((occasion) => occasion.id === occasionToDelete.id)) {
          return prev;
        }
        const next = [...prev];
        next.splice(Math.min(occasionIndex, next.length), 0, occasionToDelete);
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Unable to delete occasion");
    } finally {
      setOccasionPending(id, false);
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Occasion Management</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Create and manage shopping occasions like Diwali, Summer Sale, Back to School, etc. Hiding an occasion removes it from the storefront, seller panel, and mobile app. Show it again anytime.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="h-11 px-6">+ New Occasion</Button>
        </div>

        {/* Occasion list */}
        <div className="border border-border-soft bg-card">
          <div className="border-b border-border-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">Shop by Occasion</p>
                <p className="font-serif text-lg font-light text-foreground">All Occasions</p>
              </div>
              <p className="text-sm text-muted-foreground">{occasions.length} total</p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Loading occasions...</p></div>
          ) : occasions.length === 0 ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">No occasions yet.</p></div>
          ) : (
            <div className="divide-y divide-border-soft">
              {occasions.map((occasion) => (
                <div
                  key={occasion.id}
                  className={`flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between ${
                    pendingOccasionIds.includes(occasion.id) ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {occasion.image && (
                      <Image
                        src={occasion.image}
                        alt={occasion.name}
                        width={48}
                        height={48}
                        sizes="48px"
                        className="h-12 w-12 rounded border border-border-soft object-cover"
                      />
                    )}
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{occasion.name}</p>
                      <p className="text-xs text-muted-foreground">{occasion.slug}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {pendingOccasionIds.includes(occasion.id) ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 text-[10px] uppercase tracking-wider border border-brand/30 bg-brand/5 text-[#B84A00]">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Updating
                      </span>
                    ) : null}
                    <span className={`px-3 py-1 text-[10px] uppercase tracking-wider border ${occasion.isActive ? "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5" : "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5"}`}>
                      {occasion.isActive ? "Visible" : "Hidden"}
                    </span>
                    <Button size="sm" variant="outline" disabled={pendingOccasionIds.includes(occasion.id)} onClick={() => openEdit(occasion)}>Edit</Button>
                    <Button size="sm" variant="outline" disabled={pendingOccasionIds.includes(occasion.id)} className={occasion.isActive ? "border-[#A67575]/40 text-[#7A5656]" : "border-[#7B9971]/40 text-[#5A7352]"} onClick={() => handleToggle(occasion.id)}>
                      {occasion.isActive ? "Hide" : "Show"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={pendingOccasionIds.includes(occasion.id)} className="border-red-300/40 text-red-600" onClick={() => handleDelete(occasion.id)}>Delete</Button>
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
              <h2 className="text-xl font-semibold text-foreground mb-6">New Occasion</h2>
              <OccasionFormFields
                values={createForm}
                onChange={(field, value) => setCreateForm((prev) => ({ ...prev, [field]: value }))}
                onUpload={(file) => uploadOccasionImage({ file, mode: "create" })}
                uploading={uploadingCreateImage}
              />
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving || uploadingCreateImage}>{saving ? "Saving..." : "Create"}</Button>
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
              <h2 className="text-xl font-semibold text-foreground mb-6">Edit Occasion</h2>
              <OccasionFormFields
                values={editForm}
                onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
                onUpload={(file) => uploadOccasionImage({ file, mode: "edit" })}
                uploading={uploadingEditImage}
              />
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={saving || uploadingEditImage}>{saving ? "Saving..." : "Update"}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
