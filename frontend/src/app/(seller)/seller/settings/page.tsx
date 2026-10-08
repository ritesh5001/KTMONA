"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Building2, CheckCircle2, Landmark, MapPin, Palmtree, Store, XCircle } from "lucide-react";
import { sellerCenter, type BusinessType, type SellerSettings } from "@/services/seller-center";
import { Badge, Btn, ErrorNote, Field, Loading, PageHeader, PageShell, Panel, errorMessage, inputCls, useDebounced } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

type Tab = "store" | "business" | "pickup" | "bank" | "holiday";
const TABS: { key: Tab; label: string; icon: typeof Store }[] = [
  { key: "store", label: "Store profile", icon: Store },
  { key: "business", label: "Business & GST", icon: Building2 },
  { key: "pickup", label: "Pickup address", icon: MapPin },
  { key: "bank", label: "Bank account", icon: Landmark },
  { key: "holiday", label: "Holiday mode", icon: Palmtree },
];

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman & Nicobar", "Chandigarh", "Dadra & Nagar Haveli and Daman & Diu", "Lakshadweep",
];

export default function SettingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = React.useState<Tab>((TABS.find((t) => t.key === params.get("tab"))?.key ?? "store") as Tab);
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR("seller-settings", () => sellerCenter.settings());

  const saved = (next: SellerSettings, message: string) => {
    mutate(next, { revalidate: false });
    globalMutate((k) => Array.isArray(k) && k[0] === "seller-overview");
    toast.success(message);
  };

  return (
    <PageShell className="max-w-5xl">
      <PageHeader title="Settings" description={data ? `Seller ID ${data.sellerCode} · ${data.account.email ?? data.account.phone ?? ""}` : undefined} />
      {error && !data ? <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /> : null}
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                router.replace(`/seller/settings?tab=${t.key}`, { scroll: false });
              }}
              className={cn(
                "flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                tab === t.key ? "bg-ink text-paper dark:bg-brand dark:text-ink" : "text-foreground hover:bg-mist"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
        <div>
          {isLoading || !data ? (
            <Loading rows={5} />
          ) : tab === "store" ? (
            <StoreForm data={data} onSaved={saved} />
          ) : tab === "business" ? (
            <BusinessForm data={data} onSaved={saved} />
          ) : tab === "pickup" ? (
            <PickupForm data={data} onSaved={saved} />
          ) : tab === "bank" ? (
            <BankForm data={data} onSaved={saved} />
          ) : (
            <HolidayForm data={data} onSaved={saved} />
          )}
        </div>
      </div>
    </PageShell>
  );
}

type FormProps = { data: SellerSettings; onSaved: (next: SellerSettings, message: string) => void };

function useSave() {
  const [saving, setSaving] = React.useState(false);
  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return { saving, run };
}

function StoreForm({ data, onSaved }: FormProps) {
  const [name, setName] = React.useState(data.store?.name ?? "");
  const [description, setDescription] = React.useState(data.store?.description ?? "");
  const [logo, setLogo] = React.useState(data.store?.logo ?? "");
  const [supportEmail, setSupportEmail] = React.useState(data.store?.supportEmail ?? "");
  const [supportPhone, setSupportPhone] = React.useState(data.store?.supportPhone ?? "");
  const { saving, run } = useSave();
  const debounced = useDebounced(name.trim(), 400);
  const { data: availability } = useSWR(
    debounced.length >= 3 && debounced !== data.store?.name ? ["store-name", debounced] : null,
    () => sellerCenter.storeNameAvailable(debounced)
  );
  return (
    <Panel title="Store profile">
      <div className="space-y-4">
        <Field label="Store name" hint="Shown to customers on your products and store page.">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          {availability ? (
            <span className={cn("mt-1 flex items-center gap-1 text-xs font-medium", availability.available ? "text-emerald-600" : "text-red-600")}>
              {availability.available ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {availability.available ? `Available · ktmona.com/store/${availability.slug}` : "Already taken"}
            </span>
          ) : null}
        </Field>
        <Field label="About your store">
          <textarea rows={3} maxLength={500} className={`${inputCls} h-auto py-2`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Logo URL (optional)">
          <input className={inputCls} value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer support email">
            <input type="email" className={inputCls} value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
          </Field>
          <Field label="Customer support phone">
            <input className={inputCls} value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Btn
            variant="primary"
            loading={saving}
            disabled={name.trim().length < 3 || availability?.available === false}
            onClick={() =>
              run(async () =>
                onSaved(
                  await sellerCenter.saveStore({
                    name,
                    description: description || null,
                    logo: logo || null,
                    supportEmail: supportEmail || null,
                    supportPhone: supportPhone || null,
                  }),
                  "Store profile saved"
                )
              )
            }
          >
            Save
          </Btn>
        </div>
      </div>
    </Panel>
  );
}

function BusinessForm({ data, onSaved }: FormProps) {
  const b = data.business;
  const [businessType, setBusinessType] = React.useState<BusinessType>(b?.businessType ?? "PROPRIETORSHIP");
  const [gstRegistered, setGstRegistered] = React.useState(b?.gstRegistered ?? true);
  const [gstin, setGstin] = React.useState(b?.gstin ?? "");
  const [enrolmentId, setEnrolmentId] = React.useState(b?.enrolmentId ?? "");
  const [pan, setPan] = React.useState(b?.pan ?? "");
  const [state, setState] = React.useState(b?.state || "Haryana");
  const { saving, run } = useSave();
  if (!data.store) return <Panel title="Business & GST"><p className="text-sm text-muted-foreground">Save your store name first.</p></Panel>;
  return (
    <Panel title="Business & GST" action={b ? <Badge tone={b.kycStatus === "VERIFIED" ? "green" : b.kycStatus === "REJECTED" ? "red" : "orange"}>KYC {b.kycStatus.toLowerCase()}</Badge> : undefined}>
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { v: true, title: "I have a GSTIN", text: "Sell across India with a GST number." },
            { v: false, title: "I don't have GST", text: "Sell with a GST enrolment ID (UIN)." },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setGstRegistered(o.v)}
              className={cn("rounded-xl border p-3 text-left", gstRegistered === o.v ? "border-brand bg-brand/6" : "border-border-soft hover:border-brand/40")}
            >
              <p className="text-sm font-semibold">{o.title}</p>
              <p className="text-xs text-muted-foreground">{o.text}</p>
            </button>
          ))}
        </div>
        {gstRegistered ? (
          <Field label="GSTIN" hint="15 characters, e.g. 06ABCDE1234F1Z5">
            <input className={`${inputCls} uppercase`} value={gstin} maxLength={15} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
          </Field>
        ) : (
          <Field label="GST enrolment ID / UIN" hint="Get it free on the GST portal (Register → Enrolment for e-commerce).">
            <input className={inputCls} value={enrolmentId} onChange={(e) => setEnrolmentId(e.target.value)} />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="PAN">
            <input className={`${inputCls} uppercase`} value={pan} maxLength={10} onChange={(e) => setPan(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Business type">
            <select className={inputCls} value={businessType} onChange={(e) => setBusinessType(e.target.value as BusinessType)}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="PROPRIETORSHIP">Proprietorship</option>
              <option value="PARTNERSHIP">Partnership</option>
              <option value="LLP">LLP</option>
              <option value="PRIVATE_LIMITED">Private limited</option>
              <option value="PUBLIC_LIMITED">Public limited</option>
            </select>
          </Field>
        </div>
        <Field label="State of registration">
          <select className={inputCls} value={state} onChange={(e) => setState(e.target.value)}>
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end">
          <Btn
            variant="primary"
            loading={saving}
            onClick={() =>
              run(async () =>
                onSaved(await sellerCenter.saveBusiness({ businessType, gstRegistered, gstin: gstRegistered ? gstin : null, enrolmentId: gstRegistered ? null : enrolmentId, pan, state }), "Business details saved. KTMONA will verify them.")
              )
            }
          >
            Save
          </Btn>
        </div>
      </div>
    </Panel>
  );
}

function PickupForm({ data, onSaved }: FormProps) {
  const p = data.pickup;
  const [f, setF] = React.useState({
    contactName: p?.contactName ?? "",
    phone: p?.phone ?? "",
    line1: p?.line1 ?? "",
    line2: p?.line2 ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "Haryana",
    pincode: p?.pincode ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const { saving, run } = useSave();
  if (!data.store) return <Panel title="Pickup address"><p className="text-sm text-muted-foreground">Save your store name first.</p></Panel>;
  return (
    <Panel title="Pickup address">
      <p className="mb-4 text-sm text-muted-foreground">
        Couriers collect your orders from here, and returns come back here.{" "}
        {data.shipping.mode === "SHIPROCKET" ? "Pickups are booked automatically via Shiprocket." : "You ship orders yourself and add the courier AWB in Orders."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name"><input className={inputCls} value={f.contactName} onChange={set("contactName")} /></Field>
        <Field label="Mobile number"><input className={inputCls} value={f.phone} onChange={set("phone")} inputMode="numeric" /></Field>
        <div className="sm:col-span-2"><Field label="Address line 1"><input className={inputCls} value={f.line1} onChange={set("line1")} placeholder="Shop / building, street" /></Field></div>
        <div className="sm:col-span-2"><Field label="Address line 2 (optional)"><input className={inputCls} value={f.line2} onChange={set("line2")} placeholder="Landmark, area" /></Field></div>
        <Field label="City"><input className={inputCls} value={f.city} onChange={set("city")} /></Field>
        <Field label="Pincode"><input className={inputCls} value={f.pincode} onChange={set("pincode")} maxLength={6} inputMode="numeric" /></Field>
        <Field label="State">
          <select className={inputCls} value={f.state} onChange={set("state")}>
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Btn variant="primary" loading={saving} onClick={() => run(async () => onSaved(await sellerCenter.savePickup({ ...f, line2: f.line2 || null }), "Pickup address saved"))}>
          Save
        </Btn>
      </div>
    </Panel>
  );
}

function BankForm({ data, onSaved }: FormProps) {
  const [f, setF] = React.useState({ holderName: "", bankName: "", accountNumber: "", confirm: "", ifsc: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const { saving, run } = useSave();
  const mismatch = f.confirm.length > 0 && f.confirm !== f.accountNumber;
  if (!data.store) return <Panel title="Bank account"><p className="text-sm text-muted-foreground">Save your store name first.</p></Panel>;
  return (
    <div className="space-y-5">
      {data.bankAccounts.length > 0 ? (
        <Panel title="Payout accounts" padded={false}>
          <ul className="divide-y divide-border-soft">
            {data.bankAccounts.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Landmark className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{b.bankName} · {b.accountNumberMasked}</p>
                  <p className="text-xs text-muted-foreground">{b.holderName} · {b.ifsc}</p>
                </div>
                {b.isPrimary ? <Badge tone="green">Payouts go here</Badge> : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title={data.bankAccounts.length ? "Change payout account" : "Add bank account"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account holder name"><input className={inputCls} value={f.holderName} onChange={set("holderName")} /></Field>
          <Field label="Bank name"><input className={inputCls} value={f.bankName} onChange={set("bankName")} /></Field>
          <Field label="Account number"><input className={inputCls} value={f.accountNumber} onChange={set("accountNumber")} inputMode="numeric" /></Field>
          <Field label="Confirm account number" error={mismatch ? "Account numbers don't match" : null}>
            <input className={inputCls} value={f.confirm} onChange={set("confirm")} inputMode="numeric" />
          </Field>
          <Field label="IFSC code"><input className={`${inputCls} uppercase`} value={f.ifsc} maxLength={11} onChange={(e) => setF((p) => ({ ...p, ifsc: e.target.value.toUpperCase() }))} /></Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Btn
            variant="primary"
            loading={saving}
            disabled={mismatch || !f.confirm}
            onClick={() =>
              run(async () => {
                onSaved(await sellerCenter.addBank({ holderName: f.holderName, bankName: f.bankName, accountNumber: f.accountNumber, ifsc: f.ifsc }), "Bank account saved");
                setF({ holderName: "", bankName: "", accountNumber: "", confirm: "", ifsc: "" });
              })
            }
          >
            Save account
          </Btn>
        </div>
      </Panel>
    </div>
  );
}

function HolidayForm({ data, onSaved }: FormProps) {
  const on = data.store?.vacationMode ?? false;
  const { saving, run } = useSave();
  if (!data.store) return <Panel title="Holiday mode"><p className="text-sm text-muted-foreground">Save your store name first.</p></Panel>;
  return (
    <Panel title="Holiday mode">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{on ? "Holiday mode is ON" : "Holiday mode is OFF"}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Going away? Holiday mode hides all your live listings so you don&apos;t get orders you can&apos;t ship. Turning it off brings them back.
          </p>
        </div>
        <Btn variant={on ? "brand" : "outline"} loading={saving} onClick={() => run(async () => onSaved(await sellerCenter.setVacation(!on), on ? "Welcome back! Listings are live again." : "Holiday mode on. Listings are hidden."))}>
          {on ? "Turn off holiday mode" : "Turn on holiday mode"}
        </Btn>
      </div>
    </Panel>
  );
}
