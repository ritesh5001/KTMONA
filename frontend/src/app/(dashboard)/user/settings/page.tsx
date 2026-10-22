"use client";

import * as React from "react";
import Link from "next/link";
import { CreditCard, Loader2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelAccountDeletion,
  getDeletionRequest,
  getNotificationPreferences,
  listSavedPaymentMethods,
  removeSavedPaymentMethod,
  requestAccountDeletion,
  updateNotificationPreferences,
  type DeletionRequest,
  type NotificationPreferences,
  type SavedPaymentMethod,
} from "@/services/account";

export default function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-brand-strong">My Account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Notifications, saved payment methods and privacy.</p>
      </div>
      <NotificationSection />
      <SavedPaymentsSection />
      <PrivacySection />
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-border-soft bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-5 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, disabled, label, hint }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; hint?: string }) {
  return (
    <label className={`flex items-start justify-between gap-4 py-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-border-soft transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function NotificationSection() {
  const [prefs, setPrefs] = React.useState<NotificationPreferences | null>(null);

  React.useEffect(() => {
    getNotificationPreferences().then(setPrefs).catch(() => toast.error("Unable to load notification settings"));
  }, []);

  const save = async (patch: Partial<Omit<NotificationPreferences, "available">>) => {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      setPrefs(await updateNotificationPreferences(patch));
      toast.success("Saved");
    } catch (error) {
      setPrefs(before);
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  };

  return (
    <Section id="notifications" title="Notification preferences" description="Order, shipping and delivery updates always appear under Notifications in your account. Choose where else we send them.">
      {!prefs ? (
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      ) : (
        <div className="divide-y divide-border-soft">
          <Toggle label="Email" hint="Order confirmations are always emailed. This covers shipping, delivery and return updates." checked={prefs.email} onChange={(v) => void save({ email: v })} />
          <Toggle
            label="SMS"
            hint={prefs.available.sms ? "Updates by text message." : "We’ll start sending SMS updates once this service is live. Your choice is saved."}
            checked={prefs.sms}
            onChange={(v) => void save({ sms: v })}
          />
          <Toggle
            label="WhatsApp"
            hint={prefs.available.whatsapp ? "Updates on WhatsApp." : "We’ll start sending WhatsApp updates once this service is live. Your choice is saved."}
            checked={prefs.whatsapp}
            onChange={(v) => void save({ whatsapp: v })}
          />
          <Toggle label="Offers and promotions" hint="Sales, coupons and new arrivals." checked={prefs.marketing} onChange={(v) => void save({ marketing: v })} />
        </div>
      )}
    </Section>
  );
}

function SavedPaymentsSection() {
  const [state, setState] = React.useState<{ methods: SavedPaymentMethod[]; enabled: boolean } | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    listSavedPaymentMethods()
      .then(setState)
      .catch(() => setState({ methods: [], enabled: true }));
  }, []);
  React.useEffect(load, [load]);

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await removeSavedPaymentMethod(id);
      toast.success("Payment method removed");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove it");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Section
      id="payments"
      title="Saved payment methods"
      description="Cards and UPI IDs you chose to save in the Razorpay payment window. KTMONA never stores your card number — Razorpay keeps a secure token."
    >
      {!state ? (
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      ) : state.methods.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          No saved methods yet. Tick “Save this card” when you pay to use it faster next time.
        </p>
      ) : (
        <ul className="space-y-2">
          {state.methods.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-soft p-3">
              <span className="flex items-center gap-3">
                {m.method === "upi" ? <Smartphone className="h-5 w-5 text-muted-foreground" /> : <CreditCard className="h-5 w-5 text-muted-foreground" />}
                <span>
                  <span className="block text-sm font-medium">{m.label}</span>
                  {m.detail || m.expired ? <span className="block text-xs text-muted-foreground">{[m.detail, m.expired ? "Expired" : null].filter(Boolean).join(" · ")}</span> : null}
                </span>
              </span>
              <Button size="sm" variant="outline" disabled={removing === m.id} onClick={() => void remove(m.id)}>
                {removing === m.id ? "Removing…" : "Remove"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function PrivacySection() {
  const [request, setRequest] = React.useState<DeletionRequest | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    getDeletionRequest().then(setRequest).catch(() => setRequest({ requested: false, requestedAt: null, reason: null }));
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await requestAccountDeletion(reason);
      setRequest(r);
      setConfirming(false);
      toast.success("Deletion requested. We’ll email you when it’s done.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the request");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      setRequest(await cancelAccountDeletion());
      toast.success("Your account will stay open.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not withdraw the request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section id="privacy" title="Privacy & account" description="How we use your data, and how to close your account.">
      <p className="mb-4 text-sm">
        Read our <Link href="/privacy" className="font-medium text-brand-strong hover:underline">Privacy Policy</Link> to see what we collect and why. For a copy of your data, write to us from{" "}
        <Link href="/support" className="font-medium text-brand-strong hover:underline">Help &amp; Support</Link>.
      </p>
      {!request ? null : request.requested ? (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Account deletion requested{request.requestedAt ? ` on ${new Date(request.requestedAt).toLocaleDateString("en-IN")}` : ""}</p>
          <p>Our team will delete your account after any open orders, returns and refunds are settled. Invoices are kept as required by tax law.</p>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void withdraw()}>Keep my account</Button>
        </div>
      ) : confirming ? (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Delete your KTMONA account?</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your profile, addresses, wishlist and saved cart will be removed.</li>
            <li>Open orders, returns and refunds are completed first.</li>
            <li>Invoices are kept as required by tax law.</li>
          </ul>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Why are you leaving? (optional)" className="min-h-16 bg-white" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" disabled={busy} onClick={() => void submit()}>
              {busy ? "Sending…" : "Request deletion"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete my account
        </Button>
      )}
    </Section>
  );
}
