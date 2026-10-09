"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, PackageCheck, PhoneCall, Rocket, ShieldCheck, TrendingUp, Undo2 } from "lucide-react";
import { createSupportTicket } from "@/services/support";
import { Btn, Field, Modal, PageHeader, PageShell, Panel, errorMessage, inputCls } from "@/components/seller/kit";

/*
 * KTMONA Warehouse (Meesho "Warehouse"): fulfilment-by-KTMONA programme page.
 * Joining or asking for a callback raises a support ticket for the ops team.
 * Fee tables are the published rate card; edit here when rates change.
 */

const STEPS = ['Click on "Join Us Now" below', "Complete GST and APOB registration (we'll help you)", "Dispatch inventory to the warehouse", "Watch your business take off on KTMONA"];

const BENEFITS = [
  { icon: TrendingUp, title: "Grow Sales by 9%-11%", text: "Faster delivery badges and customer discounts without affecting your margins." },
  { icon: ShieldCheck, title: "100% Protection from RTO & Return Frauds", text: "Guaranteed approval on all valid claims." },
  { icon: Undo2, title: "Reduce Returns, RTOs & Cancellations by 6-7%", text: "Fewer damage-related returns with expert handling." },
  { icon: Rocket, title: "Supercharge Operations", text: "Real-time inventory tracking and performance insights." },
];

const WEIGHTS = ["Upto 150 gms", "151-500 gms", "501-1000 gms", "1001-2000 gms", "Above 2000 gms"];
const FEES: [string, string[]][] = [
  ["Delivered Orders (Local Zones < 500km from Warehouse)", ["₹4", "₹10", "₹13.50", "₹28", "₹38"]],
  ["Delivered Orders (National Zones > 500km from Warehouse)", ["₹15", "₹20", "₹27", "₹40", "₹67"]],
  ["Return Orders", ["₹12.75", "₹14", "₹14.75", "₹20.50", "₹20.50"]],
  ["Charges for SKUs with inventory unsold for over 30 days", ["₹7.50", "₹17", "₹28", "₹50", "₹104"]],
  ["B2B reject fee", ["₹4", "₹11", "₹17", "₹30", "₹66"]],
  ["RTO processing fee / Storage fee / Insurance charges", ["FREE", "FREE", "FREE", "FREE", "FREE"]],
];
const ONE_TIME: [string, string][] = [
  ["GST + APOB", "₹9999 + GST"],
  ["VPOB Renewal", "₹8000 + GST"],
  ["Only APOB", "₹500 + GST"],
];

export default function WarehousePage() {
  const [mode, setMode] = React.useState<"join" | "callback" | null>(null);
  const [phone, setPhone] = React.useState("");
  const [city, setCity] = React.useState("");
  const [volume, setVolume] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    setSaving(true);
    try {
      await createSupportTicket({
        subject: mode === "join" ? "Warehouse: join request" : "Warehouse: callback request",
        category: "ACCOUNT",
        message: [
          mode === "join" ? "I want to join KTMONA Warehousing." : "Please call me back about KTMONA Warehousing.",
          `Callback number: ${phone}`,
          `Preferred warehouse city: ${city || "-"}`,
          `Monthly orders: ${volume || "-"}`,
        ].join("\n"),
      });
      toast.success("Request sent. Our team will call you within 2 working days.");
      setMode(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader title="KTMONA Warehouse" />
      <Panel>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-center">
          <div>
            <h2 className="text-xl font-semibold">Join KTMONA Warehousing in 4 easy steps!</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {STEPS.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {s}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Btn variant="primary" onClick={() => setMode("join")}>Join Us Now</Btn>
              <Btn variant="outline" onClick={() => setMode("callback")}>
                <PhoneCall className="h-4 w-4" /> Request Callback
              </Btn>
            </div>
          </div>
          <div className="flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br from-ink to-navy text-paper">
            <div className="text-center">
              <PackageCheck className="mx-auto h-12 w-12 text-brand" />
              <p className="mt-2 text-lg font-semibold">Fulfilled by KTMONA</p>
              <p className="text-xs text-paper/70">We store, pack and ship. You grow.</p>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Benefits of KTMONA Warehouse">
        <div className="grid gap-5 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-strong">
                <b.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Warehouse Fees" padded={false} action={<span className="text-xs text-muted-foreground">Indicative rates. Final rates are confirmed when you join.</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="bg-mist/60 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Per Unit Charges</th>
                {WEIGHTS.map((w) => (
                  <th key={w} className="px-3 py-3 font-semibold">{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEES.map(([label, values]) => (
                <tr key={label} className="border-t border-border-soft">
                  <td className="px-4 py-3">{label}</td>
                  {values.map((v, i) => (
                    <td key={i} className={v === "FREE" ? "px-3 py-3 font-semibold text-emerald-600" : "px-3 py-3 tabular-nums"}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="One Time Charges per Warehouse Location" padded={false}>
        <table className="w-full text-left text-sm">
          <tbody>
            {ONE_TIME.map(([label, value]) => (
              <tr key={label} className="border-t border-border-soft first:border-t-0">
                <td className="px-4 py-3">{label}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Modal
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === "join" ? "Join KTMONA Warehousing" : "Request a callback"}
        footer={
          <Btn variant="primary" loading={saving} onClick={submit}>
            Submit
          </Btn>
        }
      >
        <div className="space-y-4">
          <Field label="Phone number *">
            <input className={inputCls} inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Preferred warehouse city">
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Faridabad" />
          </Field>
          <Field label="Orders per month">
            <select className={inputCls} value={volume} onChange={(e) => setVolume(e.target.value)}>
              <option value="">Select</option>
              {["Less than 100", "100 - 500", "500 - 2,000", "2,000 - 10,000", "More than 10,000"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>
    </PageShell>
  );
}
