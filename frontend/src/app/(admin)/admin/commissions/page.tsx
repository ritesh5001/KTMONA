"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import {
  getCommissionRules,
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
  getAdminCategories,
  type CommissionRule,
  type CreateCommissionRulePayload,
  type UpdateCommissionRulePayload,
  type AdminCategory,
} from "@/services/admin";
import { toast } from "sonner";

type RuleScope = "GLOBAL" | "CATEGORY" | "SELLER";

function getRuleScope(rule: { sellerId?: string | null; categoryId?: string | null }): RuleScope {
  if (rule.sellerId) return "SELLER";
  if (rule.categoryId) return "CATEGORY";
  return "GLOBAL";
}

interface FormState {
  scope: RuleScope;
  sellerId: string;
  categoryId: string;
  commissionPercent: number;
  platformFee: number;
  isActive: boolean;
}

const emptyForm: FormState = {
  scope: "GLOBAL",
  sellerId: "",
  categoryId: "",
  commissionPercent: 0,
  platformFee: 0,
  isActive: true,
};

const CommissionFormFields = ({
  values,
  onChange,
  categories,
}: {
  values: FormState;
  onChange: (field: keyof FormState, value: any) => void;
  categories: AdminCategory[];
}) => (
  <div className="space-y-4">
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Rule Scope</Label>
      <select
        value={values.scope}
        onChange={(e) => onChange("scope", e.target.value)}
        className="mt-1 flex h-11 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="GLOBAL">Global</option>
        <option value="CATEGORY">Category</option>
        <option value="SELLER">Seller</option>
      </select>
    </div>

    {values.scope === "CATEGORY" && (
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Category</Label>
        <select
          value={values.categoryId}
          onChange={(e) => onChange("categoryId", e.target.value)}
          className="mt-1 flex h-11 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    )}

    {values.scope === "SELLER" && (
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Seller ID</Label>
        <Input
          value={values.sellerId}
          onChange={(e) => onChange("sellerId", e.target.value)}
          className="mt-1 h-11"
          placeholder="Paste seller UUID"
        />
      </div>
    )}

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground" required>Commission %</Label>
        <Input
          type="number"
          min={0.01}
          max={100}
          step={0.01}
          value={values.commissionPercent}
          onChange={(e) => onChange("commissionPercent", Number(e.target.value))}
          className="mt-1 h-11"
          placeholder="e.g. 12.5"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Platform Fee (₹)</Label>
        <Input
          type="number"
          min={0}
          step={1}
          value={values.platformFee}
          onChange={(e) => onChange("platformFee", Number(e.target.value))}
          className="mt-1 h-11"
          placeholder="e.g. 50"
        />
      </div>
    </div>

    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={values.isActive}
        onChange={(e) => onChange("isActive", e.target.checked)}
        className="h-4 w-4"
      />
      Active
    </label>
  </div>
);

export default function AdminCommissionsPage() {
  const [loading, setLoading] = React.useState(true);
  const [rules, setRules] = React.useState<CommissionRule[]>([]);
  const [categories, setCategories] = React.useState<AdminCategory[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Create modal
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<FormState>({ ...emptyForm });

  // Edit modal
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<FormState>({ ...emptyForm });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [rulesResult, catResult] = await Promise.all([
        getCommissionRules(),
        getAdminCategories(),
      ]);
      setRules(rulesResult.rules ?? []);
      setCategories(catResult.categories ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load commission rules");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const formToPayload = (form: FormState): CreateCommissionRulePayload => ({
    commissionPercent: form.commissionPercent,
    platformFee: form.platformFee,
    isActive: form.isActive,
    sellerId: form.scope === "SELLER" ? form.sellerId || null : null,
    categoryId: form.scope === "CATEGORY" ? form.categoryId || null : null,
  });

  const handleCreate = async () => {
    if (createForm.commissionPercent <= 0 || createForm.commissionPercent > 100) {
      toast.error("Commission percentage must be between 0.01 and 100.");
      return;
    }
    if (createForm.scope === "CATEGORY" && !createForm.categoryId) {
      toast.error("Select a category for category-level rules.");
      return;
    }
    if (createForm.scope === "SELLER" && !createForm.sellerId) {
      toast.error("Enter a seller ID for seller-level rules.");
      return;
    }
    setSaving(true);
    try {
      await createCommissionRule(formToPayload(createForm));
      toast.success("Commission rule created.");
      setCreateForm({ ...emptyForm });
      setShowCreate(false);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create rule");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (rule: CommissionRule) => {
    setEditingId(rule.id);
    setEditForm({
      scope: getRuleScope(rule),
      commissionPercent: rule.commissionPercent,
      platformFee: rule.platformFee,
      isActive: rule.isActive,
      categoryId: rule.categoryId ?? "",
      sellerId: rule.sellerId ?? "",
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (editForm.commissionPercent <= 0 || editForm.commissionPercent > 100) {
      toast.error("Commission percentage must be between 0.01 and 100.");
      return;
    }
    setSaving(true);
    try {
      const payload: UpdateCommissionRulePayload = {
        commissionPercent: editForm.commissionPercent,
        platformFee: editForm.platformFee,
        isActive: editForm.isActive,
        sellerId: editForm.scope === "SELLER" ? editForm.sellerId || null : null,
        categoryId: editForm.scope === "CATEGORY" ? editForm.categoryId || null : null,
      };
      await updateCommissionRule(editingId, payload);
      toast.success("Commission rule updated.");
      setEditingId(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this commission rule?")) return;
    try {
      await deleteCommissionRule(id);
      toast.success("Commission rule deleted.");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete rule");
    }
  };

  const getRuleLabel = (rule: CommissionRule) => {
    const scope = getRuleScope(rule);
    if (scope === "GLOBAL") return "Global Default";
    if (scope === "CATEGORY") {
      const cat = categories.find((c) => c.id === rule.categoryId);
      return `Category: ${cat?.name ?? rule.category?.name ?? rule.categoryId}`;
    }
    const sellerLabel = rule.seller?.seller_profiles?.store_name ?? rule.seller?.email ?? rule.sellerId;
    return `Seller: ${sellerLabel}`;
  };

  const typeBadgeClass = (scope: RuleScope) => {
    if (scope === "GLOBAL") return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    if (scope === "CATEGORY") return "border-brand/30 text-[#B84A00] bg-brand/5";
    return "border-[#6B8CAE]/30 text-[#4A6B8C] bg-[#6B8CAE]/5";
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">Revenue Settings</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Commission Rules</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Configure platform commission rates at global, category, or seller level.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="h-11 px-6">+ New Rule</Button>
        </div>

        {/* Rule list */}
        <div className="border border-border-soft bg-card">
          <div className="border-b border-border-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">Configuration</p>
                <p className="font-serif text-lg font-light text-foreground">All Rules</p>
              </div>
              <p className="text-sm text-muted-foreground">{rules.length} total</p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Loading rules...</p></div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">No commission rules yet.</p></div>
          ) : (
            <div className="divide-y divide-border-soft">
              {rules.map((rule) => {
                const scope = getRuleScope(rule);
                return (
                  <div key={rule.id} className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-foreground">{getRuleLabel(rule)}</p>
                      <p className="text-xs text-muted-foreground">
                        Platform fee: ₹{rule.platformFee} · Created {new Date(rule.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1 text-[10px] uppercase tracking-wider border ${typeBadgeClass(scope)}`}>
                        {scope}
                      </span>
                      <span className={`px-3 py-1 text-[10px] uppercase tracking-wider border ${rule.isActive ? "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5" : "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5"}`}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="px-3 py-1 text-sm font-medium text-foreground">
                        {rule.commissionPercent}%
                      </span>
                      <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>Edit</Button>
                      <Button size="sm" variant="outline" className="border-[#A67575]/40 text-[#7A5656]" onClick={() => handleDelete(rule.id)}>Delete</Button>
                    </div>
                  </div>
                );
              })}
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
              <h2 className="text-xl font-semibold text-foreground mb-6">New Commission Rule</h2>
              <CommissionFormFields
                values={createForm}
                onChange={(field, value) => setCreateForm((prev) => ({ ...prev, [field]: value }))}
                categories={categories}
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
              <h2 className="text-xl font-semibold text-foreground mb-6">Edit Commission Rule</h2>
              <CommissionFormFields
                values={editForm}
                onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
                categories={categories}
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
