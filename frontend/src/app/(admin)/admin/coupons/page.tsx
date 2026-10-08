"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  toggleAdminCoupon,
  type AdminCoupon,
  type CreateCouponPayload,
  type UpdateCouponPayload,
} from "@/services/admin";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const emptyForm: CreateCouponPayload = {
  code: "",
  type: "PERCENT",
  value: 0,
  minOrderAmount: 0,
  validFrom: "",
  validUntil: "",
  isActive: true,
  firstTimeUserOnly: false,
};

const CouponFormFields = ({
  values,
  onChange,
}: {
  values: Record<string, any>;
  onChange: (field: string, value: any) => void;
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Code</Label>
        <Input
          value={values.code ?? ""}
          onChange={(e) => onChange("code", e.target.value.toUpperCase())}
          className="mt-1 h-11 font-mono"
          placeholder="SAVE20"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Type</Label>
        <select
          value={values.type ?? "PERCENT"}
          onChange={(e) => onChange("type", e.target.value)}
          className="mt-1 flex h-11 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="PERCENT">Percentage</option>
          <option value="FLAT">Flat Amount</option>
        </select>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>
          Value {values.type === "PERCENT" ? "(%)" : "(₹)"}
        </Label>
        <Input
          type="number"
          min={0}
          step={values.type === "PERCENT" ? 0.1 : 1}
          value={values.value ?? 0}
          onChange={(e) => onChange("value", Number(e.target.value))}
          className="mt-1 h-11"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Max Discount (₹)</Label>
        <Input
          type="number"
          min={0}
          value={values.maxDiscountAmount ?? ""}
          onChange={(e) => onChange("maxDiscountAmount", e.target.value ? Number(e.target.value) : null)}
          className="mt-1 h-11"
          placeholder="No limit"
        />
      </div>
    </div>

    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Min Order Amount (₹)</Label>
      <Input
        type="number"
        min={0}
        value={values.minOrderAmount ?? 0}
        onChange={(e) => onChange("minOrderAmount", Number(e.target.value))}
        className="mt-1 h-11"
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Usage Limit (total)</Label>
        <Input
          type="number"
          min={0}
          value={values.usageLimit ?? ""}
          onChange={(e) => onChange("usageLimit", e.target.value ? Number(e.target.value) : null)}
          className="mt-1 h-11"
          placeholder="Unlimited"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Per User Limit</Label>
        <Input
          type="number"
          min={0}
          value={values.perUserLimit ?? ""}
          onChange={(e) => onChange("perUserLimit", e.target.value ? Number(e.target.value) : null)}
          className="mt-1 h-11"
          placeholder="Unlimited"
        />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Valid From</Label>
        <Input
          type="datetime-local"
          value={values.validFrom ?? ""}
          onChange={(e) => onChange("validFrom", e.target.value)}
          className="mt-1 h-11"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Valid Until</Label>
        <Input
          type="datetime-local"
          value={values.validUntil ?? ""}
          onChange={(e) => onChange("validUntil", e.target.value)}
          className="mt-1 h-11"
        />
      </div>
    </div>

    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Seller ID (optional, leave blank for platform-wide)</Label>
      <Input
        value={values.sellerId ?? ""}
        onChange={(e) => onChange("sellerId", e.target.value || null)}
        className="mt-1 h-11"
        placeholder="Seller UUID"
      />
    </div>

    <div className="flex items-center gap-6">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={values.firstTimeUserOnly ?? false}
          onChange={(e) => onChange("firstTimeUserOnly", e.target.checked)}
          className="h-4 w-4"
        />
        First-time users only
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={values.isActive ?? true}
          onChange={(e) => onChange("isActive", e.target.checked)}
          className="h-4 w-4"
        />
        Active
      </label>
    </div>
  </div>
);

export default function AdminCouponsPage() {
  const [loading, setLoading] = React.useState(true);
  const [coupons, setCoupons] = React.useState<AdminCoupon[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Create modal
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<CreateCouponPayload>({ ...emptyForm });

  // Edit modal
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<UpdateCouponPayload>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminCoupons({
        page,
        limit: 20,
        search: search.trim() || undefined,
      });
      setCoupons(result.coupons ?? []);
      setTotalPages(result.pagination?.totalPages ?? 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load coupons");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  React.useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!createForm.code?.trim()) { toast.error("Code is required."); return; }
    if (createForm.value <= 0) { toast.error("Value must be greater than 0."); return; }
    if (!createForm.validFrom || !createForm.validUntil) { toast.error("Both dates are required."); return; }
    setSaving(true);
    try {
      await createAdminCoupon({ ...createForm, code: createForm.code.trim().toUpperCase() });
      toast.success("Coupon created.");
      setCreateForm({ ...emptyForm });
      setShowCreate(false);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create coupon");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (coupon: AdminCoupon) => {
    setEditingId(coupon.id);
    setEditForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minOrderAmount: coupon.minOrderAmount,
      usageLimit: coupon.usageLimit,
      perUserLimit: coupon.perUserLimit,
      validFrom: coupon.validFrom?.slice(0, 16) ?? "",
      validUntil: coupon.validUntil?.slice(0, 16) ?? "",
      isActive: coupon.isActive,
      sellerId: coupon.sellerId,
      firstTimeUserOnly: coupon.firstTimeUserOnly,
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await updateAdminCoupon(editingId, editForm);
      toast.success("Coupon updated.");
      setEditingId(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update coupon");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const result = await toggleAdminCoupon(id);
      toast.success(result.coupon.isActive ? "Coupon activated." : "Coupon deactivated.");
      setCoupons((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive: result.coupon.isActive } : c))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to toggle coupon");
    }
  };

  const handleDelete = async (coupon: AdminCoupon) => {
    if (coupon.usedCount > 0) {
      toast.error("Cannot delete a coupon that has been used. Deactivate it instead.");
      return;
    }
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    try {
      await deleteAdminCoupon(coupon.id);
      toast.success("Coupon deleted.");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete coupon");
    }
  };

  const isExpired = (coupon: AdminCoupon) => new Date(coupon.validUntil) < new Date();

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 lg:py-20"
      >
        <div className="flex items-end justify-between">
          <div className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">Promotions</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Coupon Management</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Create and manage discount coupons for the platform.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="h-11 px-6">+ New Coupon</Button>
        </div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="border border-border-soft bg-card p-4 flex items-center gap-3"
        >
          <Input
            placeholder="Search coupons by code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border-0 bg-transparent focus-visible:ring-0 h-10"
          />
        </motion.div>

        {/* Coupon list */}
        <div className="border border-border-soft bg-card">
          <div className="border-b border-border-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">Promotions</p>
                <p className="font-serif text-lg font-light text-foreground">All Coupons</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Loading coupons...</p></div>
          ) : coupons.length === 0 ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">No coupons found.</p></div>
          ) : (
            <div className="divide-y divide-border-soft">
              {coupons.map((coupon) => (
                <div key={coupon.id} className={`flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between ${isExpired(coupon) ? "opacity-50" : ""}`}>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-lg font-medium text-foreground">{coupon.code}</p>
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider border border-brand/30 text-[#B84A00] bg-brand/5">
                        {coupon.type === "PERCENT" ? `${coupon.value}%` : currency.format(coupon.value)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Min order: {currency.format(coupon.minOrderAmount)}
                      {coupon.maxDiscountAmount ? ` · Max discount: ${currency.format(coupon.maxDiscountAmount)}` : ""}
                      {coupon.usageLimit ? ` · Limit: ${coupon.usedCount}/${coupon.usageLimit}` : ` · Used: ${coupon.usedCount}`}
                      {coupon.firstTimeUserOnly ? " · New users only" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(coupon.validFrom).toLocaleDateString()} → {new Date(coupon.validUntil).toLocaleDateString()}
                      {isExpired(coupon) ? " (Expired)" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 text-[10px] uppercase tracking-wider border ${coupon.isActive ? "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5" : "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5"}`}>
                      {coupon.isActive ? "Active" : "Inactive"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => openEdit(coupon)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={coupon.isActive ? "border-[#A67575]/40 text-[#7A5656]" : "border-[#7B9971]/40 text-[#5A7352]"}
                      onClick={() => handleToggle(coupon.id)}
                    >
                      {coupon.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300/40 text-red-600"
                      disabled={coupon.usedCount > 0}
                      onClick={() => handleDelete(coupon)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border-soft bg-card p-6 shadow-xl">
              <button onClick={() => setShowCreate(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              <h2 className="text-xl font-semibold text-foreground mb-6">New Coupon</h2>
              <CouponFormFields
                values={createForm}
                onChange={(field, value) => setCreateForm((prev) => ({ ...prev, [field]: value }))}
              />
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
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
              <h2 className="text-xl font-semibold text-foreground mb-6">Edit Coupon</h2>
              <CouponFormFields
                values={editForm}
                onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
              />
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={saving}>{saving ? "Saving..." : "Update"}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
