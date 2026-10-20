"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Globe, Mail, MapPin, Package, Phone, ScanBarcode, ShoppingBag, XCircle } from "lucide-react";
import { packagingApi, type PacketQueueItem } from "@/services/platform";
import { Btn, Field, Modal, errorMessage, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

/**
 * The two Meesho-style notices at the top of Orders:
 *  1. "Label download failed? We'll retry automatically" — only while some
 *     accepted orders are still waiting for their courier label.
 *  2. The barcoded-packaging policy with "Buy Barcoded Packets" (supplier
 *     details set by the admin) and "Scan Barcoded Packets".
 */
export function OrdersPackagingBanners() {
  const { data: labels } = useSWR("seller-label-status", packagingApi.labelStatus, { refreshInterval: 5 * 60_000 });
  const [buyOpen, setBuyOpen] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);
  const pending = labels?.pendingLabels ?? 0;

  return (
    <div className="space-y-3">
      {pending > 0 ? (
        <div className="flex items-center gap-4 rounded-2xl border border-amber-300/60 bg-amber-50 p-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Package className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-base font-semibold text-foreground">
              <span className="inline-flex items-center gap-1"><XCircle className="h-5 w-5 text-red-600" /> Label download failed?</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> KTMONA will retry automatically</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {pending} {pending === 1 ? "order is" : "orders are"} waiting for the courier label. We will notify you once it&apos;s ready for download.
            </p>
            <p className="text-sm text-muted-foreground">Don&apos;t worry! Your orders will not be blocked or lose visibility. You can also print the KTMONA label meanwhile.</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-card p-4 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
          <ShoppingBag className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          As per KTMONA packaging policy, all sellers must use Transparent Barcoded Packaging for their products on the platform.
        </p>
        <div className="flex shrink-0 gap-2">
          <Btn variant="outline" size="sm" onClick={() => setBuyOpen(true)}>Buy Barcoded Packets</Btn>
          <Btn variant="outline" size="sm" onClick={() => setScanOpen(true)}><ScanBarcode className="h-4 w-4" /> Scan Barcoded Packets</Btn>
        </div>
      </div>

      <BuyPacketsModal open={buyOpen} onClose={() => setBuyOpen(false)} />
      <ScanPacketsModal open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  );
}

function BuyPacketsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useSWR(open ? "seller-packaging-supplier" : null, packagingApi.supplier);
  const s = data?.supplier;
  const digits = (v: string) => v.replace(/[^\d+]/g, "");
  return (
    <Modal open={open} onClose={onClose} title="Buy Barcoded Packets" footer={<Btn variant="outline" onClick={onClose}>Close</Btn>}>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-mist" />
      ) : !s ? (
        <p className="text-sm text-muted-foreground">
          The packaging supplier details will appear here soon. Meanwhile, contact KTMONA seller support for transparent barcoded packets.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved packaging supplier</p>
            <p className="mt-1 text-lg font-semibold">{s.shopName}</p>
            {s.contactName ? <p className="text-sm text-muted-foreground">Contact: {s.contactName}</p> : null}
          </div>
          <ul className="space-y-2 text-sm">
            {s.phone ? <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><a className="hover:underline" href={`tel:${digits(s.phone)}`}>{s.phone}</a></li> : null}
            {s.whatsapp ? (
              <li className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-600">WA</span>
                <a className="hover:underline" href={`https://wa.me/${digits(s.whatsapp).replace(/^\+/, "")}?text=${encodeURIComponent("Hi, I am a KTMONA seller. I want to order transparent barcoded packets.")}`} target="_blank" rel="noopener noreferrer">
                  Chat on WhatsApp ({s.whatsapp})
                </a>
              </li>
            ) : null}
            {s.email ? <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><a className="hover:underline" href={`mailto:${s.email}`}>{s.email}</a></li> : null}
            {s.address ? <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /><span className="whitespace-pre-line">{s.address}</span></li> : null}
            {s.website ? <li className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><a className="text-brand-strong hover:underline" href={s.website} target="_blank" rel="noopener noreferrer">Order online</a></li> : null}
          </ul>
          {s.priceNote ? (
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="font-semibold">Prices</p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">{s.priceNote}</p>
            </div>
          ) : null}
          {s.notes ? <p className="whitespace-pre-line text-xs text-muted-foreground">{s.notes}</p> : null}
        </div>
      )}
    </Modal>
  );
}

function ScanPacketsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading, mutate } = useSWR(open ? "seller-packet-queue" : null, packagingApi.packets);
  const [orderId, setOrderId] = React.useState("");
  const [code, setCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const orders = data?.orders ?? [];
  const waiting = orders.filter((o) => !o.packetBarcode);

  React.useEffect(() => {
    if (!open) return;
    setCode("");
    setOrderId((cur) => cur || waiting[0]?.orderId || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  const save = async () => {
    if (!orderId || !code.trim()) return;
    setSaving(true);
    try {
      const res = await packagingApi.scanPacket(orderId, code.trim());
      await mutate(res, { revalidate: false });
      toast.success("Packet linked to the order");
      setCode("");
      const next = res.orders.find((o) => !o.packetBarcode);
      setOrderId(next?.orderId ?? "");
      inputRef.current?.focus();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} wide title="Scan Barcoded Packets" footer={<Btn variant="outline" onClick={onClose}>Done</Btn>}>
      <p className="text-sm text-muted-foreground">
        Pick an order, then scan the barcode on the transparent packet you packed it in (a USB / Bluetooth barcode scanner types it in for you), or type it.
        Each packet can be used for one order only. This helps your claims if a customer returns the wrong item.
      </p>
      {isLoading ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-mist" />
      ) : orders.length === 0 ? (
        <p className="mt-4 rounded-xl bg-mist p-4 text-sm">No accepted orders waiting to be packed. Accept orders from the Pending tab first.</p>
      ) : (
        <>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Field label="Order">
              <select className={inputCls} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">Choose an order</option>
                {orders.map((o) => (
                  <option key={o.orderId} value={o.orderId}>
                    {o.orderId.slice(0, 8).toUpperCase()}{o.awb ? ` · AWB ${o.awb}` : ""}{o.packetBarcode ? " · scanned" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Packet barcode">
              <input ref={inputRef} className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan or type" autoFocus autoComplete="off" />
            </Field>
            <Btn type="submit" variant="brand" loading={saving} disabled={!orderId || !code.trim()}>Save</Btn>
          </form>
          <ul className="mt-4 divide-y divide-border-soft rounded-xl border border-border-soft">
            {orders.map((o: PacketQueueItem) => (
              <li key={o.orderId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-mono">{o.orderId.slice(0, 8).toUpperCase()}</span>
                <span className="truncate text-xs text-muted-foreground">{o.carrier}{o.awb ? ` · ${o.awb}` : ""}</span>
                <span className={cn("text-xs font-semibold", o.packetBarcode ? "text-emerald-600" : "text-amber-600")}>
                  {o.packetBarcode ? `Packet ${o.packetBarcode}` : "Not scanned"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{waiting.length} of {orders.length} orders still need a packet scan.</p>
        </>
      )}
    </Modal>
  );
}
