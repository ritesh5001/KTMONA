"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getAddresses,
  createAddress,
  updateAddress,
  type Address,
  type AddressLabel,
} from "@/services/addresses";

const LABELS: { value: AddressLabel; label: string }[] = [
  { value: "HOME", label: "Home" },
  { value: "OFFICE", label: "Office" },
  { value: "OTHER", label: "Other" },
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

interface FormState {
  label: AddressLabel;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const emptyForm: FormState = {
  label: "HOME",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
};

function AddressFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const isEdit = Boolean(editId);

  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [loadingExisting, setLoadingExisting] = React.useState(isEdit);

  // Load existing address when editing
  React.useEffect(() => {
    if (!editId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { addresses } = await getAddresses();
        const target = addresses.find((a: Address) => a.id === editId);
        if (!target) {
          toast.error("Address not found");
          router.replace("/user/addresses");
          return;
        }
        if (!cancelled) {
          setForm({
            label: target.label,
            addressLine1: target.addressLine1,
            addressLine2: target.addressLine2 ?? "",
            city: target.city,
            state: target.state,
            pincode: target.pincode,
            isDefault: target.isDefault,
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load address");
        router.replace("/user/addresses");
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [editId, router]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Client-side validation
    if (!form.addressLine1.trim()) { toast.error("Address line 1 is required"); return; }
    if (!form.city.trim()) { toast.error("City is required"); return; }
    if (!form.state.trim()) { toast.error("State is required"); return; }
    if (!/^\d{6}$/.test(form.pincode.trim())) { toast.error("Pincode must be 6 digits"); return; }

    setSubmitting(true);
    try {
      if (isEdit && editId) {
        await updateAddress(editId, {
          label: form.label,
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
        });
        toast.success("Address updated");
      } else {
        await createAddress({
          label: form.label,
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          isDefault: form.isDefault,
        });
        toast.success("Address added");
      }
      router.push("/user/addresses");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const selectClass =
    "flex h-12 w-full rounded-sm border border-border-soft bg-card px-4 text-sm text-foreground transition-all duration-300 ease-out focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 appearance-none";

  return (
    <div className="min-h-[50vh]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex w-full max-w-3xl flex-col gap-8"
      >
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            {isEdit ? "Edit Address" : "New Address"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {isEdit ? "Update Address" : "Add Address"}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {isEdit
              ? "Modify the details below and save your changes."
              : "Enter your delivery address details below."}
          </p>
        </div>

        {loadingExisting ? (
          <div className="border border-border-soft bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">Loading address…</p>
          </div>
        ) : (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="border border-border-soft bg-card"
          >
            <div className="border-b border-border-soft p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Address Details
              </p>
              <p className="font-serif text-lg font-light text-foreground">
                Delivery Information
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Label */}
              <div className="space-y-2">
                <Label htmlFor="label">Address Type</Label>
                <select
                  id="label"
                  value={form.label}
                  onChange={(e) => set("label", e.target.value as AddressLabel)}
                  className={selectClass}
                >
                  {LABELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Address Line 1 */}
              <div className="space-y-2">
                <Label htmlFor="addressLine1" required>
                  Address Line 1 <span className="text-[#A67575]">*</span>
                </Label>
                <Input
                  id="addressLine1"
                  placeholder="Flat / House No., Building, Street"
                  value={form.addressLine1}
                  onChange={(e) => set("addressLine1", e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              {/* Address Line 2 */}
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  placeholder="Landmark, Area (optional)"
                  value={form.addressLine2}
                  onChange={(e) => set("addressLine2", e.target.value)}
                  maxLength={200}
                />
              </div>

              {/* City + State row */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city" required>
                    City <span className="text-[#A67575]">*</span>
                  </Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" required>
                    State <span className="text-[#A67575]">*</span>
                  </Label>
                  <select
                    id="state"
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                    className={selectClass}
                    required
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pincode */}
              <div className="max-w-xs space-y-2">
                <Label htmlFor="pincode" required>
                  Pincode <span className="text-[#A67575]">*</span>
                </Label>
                <Input
                  id="pincode"
                  placeholder="6-digit pincode"
                  value={form.pincode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    set("pincode", v);
                  }}
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              </div>

              {/* Default checkbox (only for create) */}
              {!isEdit && (
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => set("isDefault", e.target.checked)}
                    className="h-4 w-4 rounded-sm border-border-soft accent-brand"
                  />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                    Set as default delivery address
                  </span>
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-border-soft p-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <motion.div whileHover={{ x: -2 }} transition={{ duration: 0.2 }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/user/addresses")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? isEdit
                      ? "Saving…"
                      : "Adding…"
                    : isEdit
                      ? "Save Changes"
                      : "Add Address"}
                </Button>
              </motion.div>
            </div>
          </motion.form>
        )}

        {/* Back link */}
        <section className="border-t border-border-soft pt-8">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/user/addresses"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Back to Addresses
            </Link>
            <span className="h-1 w-1 rounded-full bg-border-soft" />
            <Link
              href="/user/profile"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Profile
            </Link>
          </div>
        </section>
      </motion.div>
    </div>
  );
}

export default function AddressFormPage() {
  return (
    <React.Suspense fallback={null}>
      <AddressFormContent />
    </React.Suspense>
  );
}
