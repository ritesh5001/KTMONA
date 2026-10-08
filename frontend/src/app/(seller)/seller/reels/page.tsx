"use client";

import * as React from "react";
import ImageKit from "imagekit-javascript";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Loader2, Pencil, Plus, Trash2, Video, X, Heart, Eye, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  listSellerReels,
  createSellerReel,
  deleteSellerReel,
  updateSellerReel,
  getSellerReelAnalytics,
  type Reel,
  type SellerReelAnalytics,
} from "@/services/reels";
import { listSellerProducts, type SellerProduct } from "@/services/seller-products";

const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const MAX_REEL_DURATION_SECONDS = 60;

const getStatusBadge = (status: string) => {
  const s = status.toUpperCase();
  if (s === "APPROVED")
    return {
      label: "APPROVED",
      className: "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5",
    };
  if (s === "REJECTED")
    return {
      label: "REJECTED",
      className: "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5",
    };
  return {
    label: "PENDING",
    className: "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5",
  };
};

export default function SellerReelsPage() {
  const [reels, setReels] = React.useState<Reel[]>([]);
  const [products, setProducts] = React.useState<SellerProduct[]>([]);
  const productsRequestedRef = React.useRef(false);

  /** Fetches the tag-a-product options the first time a modal needs them. */
  const ensureProducts = React.useCallback(async () => {
    if (productsRequestedRef.current) return;
    productsRequestedRef.current = true;
    try {
      const result = await listSellerProducts();
      setProducts(result.products ?? []);
    } catch {
      // Non-fatal: the reel can still be published without a tagged product.
      productsRequestedRef.current = false;
    }
  }, []);
  const [loading, setLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [form, setForm] = React.useState({
    caption: "",
    productId: "",
    category: "MENS" as "MENS" | "KIDS",
  });
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editingReelId, setEditingReelId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState({
    caption: "",
    productId: "",
    category: "MENS" as "MENS" | "KIDS",
  });
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [videoUrl, setVideoUrl] = React.useState("");
  const [thumbnailUrl, setThumbnailUrl] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [analytics, setAnalytics] = React.useState<SellerReelAnalytics[]>([]);
  const [showAnalytics, setShowAnalytics] = React.useState(false);

  const imagekit = React.useMemo(() => {
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_URL_ENDPOINT || !API_BASE_URL) return null;
    return new ImageKit({
      publicKey: IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    });
  }, []);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    // The product list only fills a dropdown inside the create/edit modals, so it
    // is fetched when one opens rather than on every visit to this page.
    const results = await Promise.allSettled([
      listSellerReels(),
      getSellerReelAnalytics(),
    ]);
    if (results[0].status === "fulfilled") setReels(results[0].value.reels ?? []);
    else toast.error("Unable to load reels");
    if (results[1].status === "fulfilled") setAnalytics(results[1].value.analytics ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imagekit) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video must be under 100MB");
      return;
    }

    // Duration validation: max 1 minute
    const durationOk = await new Promise<boolean>((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > MAX_REEL_DURATION_SECONDS) {
          toast.error("Reel must be 1 minute or less");
          resolve(false);
        } else {
          resolve(true);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        // Can't check duration — allow upload and let backend enforce
        resolve(true);
      };
      video.src = URL.createObjectURL(file);
    });
    if (!durationOk) return;

    setUploading(true);
    try {
      const authRes = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
      const authData = await authRes.json();

      const result = await imagekit.upload({
        file,
        fileName: `reel-${Date.now()}.${file.name.split(".").pop()}`,
        folder: "/reels",
        token: authData.token,
        signature: authData.signature,
        expire: authData.expire,
      });

      setVideoUrl(result.url);
      if (result.thumbnailUrl) setThumbnailUrl(result.thumbnailUrl);
      toast.success("Video uploaded successfully");
    } catch {
      toast.error("Failed to upload video");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) {
      toast.error("Please upload a video first");
      return;
    }

    try {
      await createSellerReel({
        videoUrl,
        thumbnailUrl: thumbnailUrl || undefined,
        caption: form.caption || undefined,
        category: form.category,
        productId: form.productId || undefined,
      });
      toast.success("Reel submitted for approval");
      setShowCreateModal(false);
      setForm({ caption: "", productId: "", category: "MENS" });
      setVideoUrl("");
      setThumbnailUrl("");
      await loadAll();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create reel"
      );
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteSellerReel(id);
      toast.success("Reel deleted");
      setReels((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete reel"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (reel: Reel) => {
    void ensureProducts();
    setEditingReelId(reel.id);
    setEditForm({
      caption: reel.caption ?? "",
      productId: reel.productId ?? "",
      category: reel.category,
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReelId) return;

    setSavingEdit(true);
    try {
      const result = await updateSellerReel(editingReelId, {
        caption: editForm.caption,
        category: editForm.category,
        productId: editForm.productId || null,
      });

      toast.success("Reel updated and sent for approval");
      setReels((prev) => prev.map((r) => (r.id === editingReelId ? result.reel : r)));
      setShowEditModal(false);
      setEditingReelId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update reel");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Reels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload short videos to promote your products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showAnalytics ? "primary" : "outline"}
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
          <Button
            onClick={() => {
              void ensureProducts();
              setShowCreateModal(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Reel
          </Button>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-xl shadow-lg p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Create Reel</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-md hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                {/* Video Upload */}
                <div>
                  <Label required>Video</Label>
                  {videoUrl ? (
                    <div className="mt-2 relative rounded-lg overflow-hidden border border-border">
                      <video
                        src={videoUrl}
                        className="w-full h-48 object-cover"
                        controls
                      />
                      <button
                        type="button"
                        onClick={() => { setVideoUrl(""); setThumbnailUrl(""); }}
                        className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="mt-2 flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      {uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Video className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">
                            Click to upload video
                          </span>
                          <span className="text-xs text-muted-foreground/60 mt-1">
                            Max 100MB · 1 minute
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleVideoUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>

                {/* Caption */}
                <div>
                  <Label>Caption</Label>
                  <Input
                    className="mt-1"
                    placeholder="Add a caption..."
                    maxLength={500}
                    value={form.caption}
                    onChange={(e) =>
                      setForm({ ...form, caption: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label required>Category</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as "MENS" | "KIDS" })
                    }
                  >
                    <option value="MENS">Mens</option>
                    <option value="KIDS">Kids</option>
                  </select>
                </div>

                {/* Product Selector */}
                <div>
                  <Label>Tag a Product</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.productId}
                    onChange={(e) =>
                      setForm({ ...form, productId: e.target.value })
                    }
                  >
                    <option value="">None</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <Button type="submit" className="w-full" disabled={uploading || !videoUrl}>
                  Submit for Approval
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-xl shadow-lg p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Edit Reel</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1 rounded-md hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <Label>Caption</Label>
                  <Input
                    className="mt-1"
                    placeholder="Add a caption..."
                    maxLength={500}
                    value={editForm.caption}
                    onChange={(e) =>
                      setEditForm({ ...editForm, caption: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label required>Category</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm({ ...editForm, category: e.target.value as "MENS" | "KIDS" })
                    }
                  >
                    <option value="MENS">Mens</option>
                    <option value="KIDS">Kids</option>
                  </select>
                </div>

                <div>
                  <Label>Tag a Product</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={editForm.productId}
                    onChange={(e) =>
                      setEditForm({ ...editForm, productId: e.target.value })
                    }
                  >
                    <option value="">None</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-muted-foreground">
                  Saving changes will submit this reel for approval again.
                </p>

                <Button type="submit" className="w-full" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analytics Panel */}
      {showAnalytics && analytics.length > 0 && (
        <div className="mb-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="border border-border rounded-xl p-4 bg-card text-center">
              <Eye className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-semibold">
                {analytics.reduce((s, a) => s + a.views, 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Views</p>
            </div>
            <div className="border border-border rounded-xl p-4 bg-card text-center">
              <Heart className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-semibold">
                {analytics.reduce((s, a) => s + a.likes, 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Likes</p>
            </div>
            <div className="border border-border rounded-xl p-4 bg-card text-center">
              <MousePointerClick className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-semibold">
                {analytics.reduce((s, a) => s + a.productClicks, 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Product Clicks</p>
            </div>
          </div>

          {/* Per-Reel Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Reel</th>
                  <th className="text-right px-4 py-2 font-medium">Views</th>
                  <th className="text-right px-4 py-2 font-medium">Likes</th>
                  <th className="text-right px-4 py-2 font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {analytics.map((a) => (
                  <tr key={a.reelId} className="border-t border-border">
                    <td className="px-4 py-2 truncate max-w-50">
                      {a.caption || a.product?.title || a.reelId.slice(0, 8)}
                    </td>
                    <td className="text-right px-4 py-2">{a.views.toLocaleString()}</td>
                    <td className="text-right px-4 py-2">{a.likes.toLocaleString()}</td>
                    <td className="text-right px-4 py-2">{a.productClicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reel List */}
      {reels.length === 0 ? (
        <div className="text-center py-20">
          <Video className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No reels yet. Create your first reel!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reels.map((reel) => {
            const badge = getStatusBadge(reel.status);
            return (
              <div
                key={reel.id}
                className="border border-border rounded-xl overflow-hidden bg-card"
              >
                {/* Video Preview */}
                <div className="relative aspect-9/16 max-h-64 bg-muted">
                  <video
                    src={reel.videoUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                    onMouseLeave={(e) => {
                      const v = e.target as HTMLVideoElement;
                      v.pause();
                      v.currentTime = 0;
                    }}
                  />
                </div>

                {/* Info */}
                <div className="p-3 space-y-2">
                  {reel.caption && (
                    <p className="text-sm line-clamp-2">{reel.caption}</p>
                  )}

                  <p className="text-xs font-semibold text-primary">
                    Category: {reel.category === "MENS" ? "Mens" : "Kids"}
                  </p>

                  {reel.product && (
                    <p className="text-xs text-muted-foreground truncate">
                      Product: {reel.product.title}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {reel.views} views · {reel.likes} likes
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(reel)}
                        disabled={deletingId === reel.id}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit reel"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(reel.id)}
                        disabled={deletingId === reel.id}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete reel"
                      >
                        {deletingId === reel.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
