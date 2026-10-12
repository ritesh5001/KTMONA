"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { packagingApi } from "@/services/platform";
import { Btn, ErrorNote, Field, Loading, PageHeader, PageShell, Panel, errorMessage, inputCls } from "@/components/seller/kit";

const EMPTY = { enabled: true, shopName: "", contactName: "", phone: "", whatsapp: "", email: "", address: "", website: "", priceNote: "", notes: "" };

/** The supplier sellers see under Orders → "Buy Barcoded Packets". */
export default function PackagingSupplierPage() {
  const { data, error, isLoading, mutate } = useSWR("admin-packaging-supplier", packagingApi.adminSupplier);
  const [f, setF] = React.useState(EMPTY);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const s = data?.supplier;
    if (!s) return;
    setF({
      enabled: s.enabled,
      shopName: s.shopName,
      contactName: s.contactName ?? "",
      phone: s.phone ?? "",
      whatsapp: s.whatsapp ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      website: s.website ?? "",
      priceNote: s.priceNote ?? "",
      notes: s.notes ?? "",
    });
  }, [data]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await mutate(packagingApi.saveAdminSupplier(f), { revalidate: false });
      toast.success("Supplier details saved. Sellers see them under Orders → Buy Barcoded Packets.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Packaging Supplier"
        description="KTMONA asks every seller to pack orders in transparent barcoded packets. The supplier you enter here is shown to sellers when they click “Buy Barcoded Packets” on their Orders page."
        actions={<Btn variant="brand" loading={saving} disabled={f.shopName.trim().length < 2} onClick={save}>Save</Btn>}
      />
      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading />
      ) : (
        <Panel>
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.enabled} onChange={(e) => setF((p) => ({ ...p, enabled: e.target.checked }))} />
            Show this supplier to sellers
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Supplier shop name"><input className={inputCls} value={f.shopName} onChange={set("shopName")} placeholder="e.g. Shree Packaging, Faridabad" /></Field>
            <Field label="Contact person"><input className={inputCls} value={f.contactName} onChange={set("contactName")} /></Field>
            <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} placeholder="+91 …" /></Field>
            <Field label="WhatsApp number" hint="Sellers get a one-tap “Chat on WhatsApp” button."><input className={inputCls} value={f.whatsapp} onChange={set("whatsapp")} placeholder="+91 …" /></Field>
            <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={set("email")} /></Field>
            <Field label="Online order link"><input className={inputCls} type="url" value={f.website} onChange={set("website")} placeholder="https://" /></Field>
            <div className="md:col-span-2"><Field label="Shop address"><textarea rows={2} className={`${inputCls} h-auto py-2`} value={f.address} onChange={set("address")} /></Field></div>
            <div className="md:col-span-2"><Field label="Prices" hint="e.g. Small (6×8 in) ₹1.20 each, min 500 · Medium (10×12 in) ₹1.80 each"><textarea rows={3} className={`${inputCls} h-auto py-2`} value={f.priceNote} onChange={set("priceNote")} /></Field></div>
            <div className="md:col-span-2"><Field label="Other notes for sellers"><textarea rows={2} className={`${inputCls} h-auto py-2`} value={f.notes} onChange={set("notes")} /></Field></div>
          </div>
        </Panel>
      )}
    </PageShell>
  );
}
