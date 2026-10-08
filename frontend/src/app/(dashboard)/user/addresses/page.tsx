"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getAddresses,
  deleteAddress,
  setDefaultAddress,
  type Address,
} from "@/services/addresses";

const LABEL_DISPLAY: Record<string, string> = {
  HOME: "Home",
  OFFICE: "Office",
  OTHER: "Other",
};

export default function AddressListPage() {
  const router = useRouter();
  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const { addresses: data } = await getAddresses();
      setAddresses(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load addresses");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSetDefault = async (id: string) => {
    setActionId(id);
    try {
      await setDefaultAddress(id);
      toast.success("Default address updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update default");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionId(id);
    try {
      await deleteAddress(id);
      toast.success("Address removed");
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete address");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-[50vh]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex w-full flex-col gap-8"
      >
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
              Delivery Addresses
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Your Addresses
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Manage saved addresses for seamless checkout.
            </p>
          </div>

          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3 }}>
            <Button asChild>
              <Link href="/user/addresses/form">Add New Address</Link>
            </Button>
          </motion.div>
        </div>

        {/* List */}
        <section className="space-y-4">
          {loading ? (
            <div className="border border-border-soft bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading your addresses…</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="border border-border-soft bg-card p-12 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                No saved addresses yet. Add one to speed up checkout.
              </p>
              <Button asChild>
                <Link href="/user/addresses/form">Add Address</Link>
              </Button>
            </div>
          ) : (
            addresses.map((addr, index) => (
              <motion.div
                key={addr.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05, duration: 0.5 }}
                className="border border-border-soft bg-card"
              >
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
                  {/* Address content */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider border border-border-soft bg-mist/30 text-muted-foreground">
                        {LABEL_DISPLAY[addr.label] ?? addr.label}
                      </span>
                      {addr.isDefault && (
                        <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider border border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-foreground">
                      <p>{addr.addressLine1}</p>
                      {addr.addressLine2 && (
                        <p className="text-muted-foreground">{addr.addressLine2}</p>
                      )}
                      <p>
                        {addr.city}, {addr.state} — {addr.pincode}
                      </p>
                      <p className="text-muted-foreground">{addr.country}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <motion.div whileHover={{ x: 2 }} transition={{ duration: 0.2 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/user/addresses/form?id=${addr.id}`)}
                      >
                        Edit
                      </Button>
                    </motion.div>

                    {!addr.isDefault && (
                      <motion.div whileHover={{ x: 2 }} transition={{ duration: 0.2 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionId === addr.id}
                          onClick={() => handleSetDefault(addr.id)}
                        >
                          {actionId === addr.id ? "Updating…" : "Set Default"}
                        </Button>
                      </motion.div>
                    )}

                    {confirmDeleteId === addr.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionId === addr.id}
                          onClick={() => handleDelete(addr.id)}
                          className="border-[#A67575]/30 text-[#7A5656] hover:bg-[#A67575]/5"
                        >
                          {actionId === addr.id ? "Deleting…" : "Confirm"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <motion.div whileHover={{ x: 2 }} transition={{ duration: 0.2 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(addr.id)}
                          className="text-[#7A5656]"
                        >
                          Remove
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </section>

        {/* Navigation */}
        <section className="border-t border-border-soft pt-8">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/user/profile"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Profile
            </Link>
            <span className="h-1 w-1 rounded-full bg-border-soft" />
            <Link
              href="/user/orders"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Orders
            </Link>
            <span className="h-1 w-1 rounded-full bg-border-soft" />
            <Link
              href="/marketplace"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Continue Shopping
            </Link>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
