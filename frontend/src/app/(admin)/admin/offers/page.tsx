"use client";

import * as React from "react";
import { Gift, Loader2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getOffersConfig, saveOffersConfig, type OffersConfig } from "@/services/admin-trust";

type Section = keyof OffersConfig;

export default function AdminOffersPage() {
  const [config, setConfig] = React.useState<OffersConfig | null>(null);
  const [saving, setSaving] = React.useState<Section | null>(null);

  React.useEffect(() => {
    getOffersConfig().then(setConfig).catch(() => toast.error("Unable to load offer settings"));
  }, []);

  const set = <S extends Section>(section: S, key: keyof OffersConfig[S], value: number | boolean) =>
    setConfig((c) => (c ? { ...c, [section]: { ...c[section], [key]: value } } : c));

  const save = async (section: Section) => {
    if (!config) return;
    setSaving(section);
    try {
      setConfig(await saveOffersConfig({ [section]: config[section] }));
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(null);
    }
  };

  if (!config) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Offers & Rewards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cashback, referral and welcome-offer rules. Changes apply to new orders straight away. Coupons are managed under Coupons.
        </p>
      </header>

      <Card icon={Wallet} title="Cashback wallet" enabled={config.cashback.enabled} onToggle={(v) => set("cashback", "enabled", v)} onSave={() => void save("cashback")} saving={saving === "cashback"}>
        <Num label="Cashback (% of items)" value={config.cashback.percent} onChange={(v) => set("cashback", "percent", v)} />
        <Num label="Max cashback per order (₹, 0 = no cap)" value={config.cashback.maxPerOrder} onChange={(v) => set("cashback", "maxPerOrder", v)} />
        <Num label="Held after delivery (days)" value={config.cashback.holdDays} onChange={(v) => set("cashback", "holdDays", v)} hint="Keep this equal to the return window (7 days)." />
        <Num label="Usable for (days)" value={config.cashback.expiryDays} onChange={(v) => set("cashback", "expiryDays", v)} />
        <Num label="Max part of an order paid by cashback (%)" value={config.cashback.maxUsePercent} onChange={(v) => set("cashback", "maxUsePercent", v)} />
      </Card>

      <Card icon={Users} title="Referral program" enabled={config.referral.enabled} onToggle={(v) => set("referral", "enabled", v)} onSave={() => void save("referral")} saving={saving === "referral"}>
        <Num label="Friend's discount on first order (₹)" value={config.referral.friendAmount} onChange={(v) => set("referral", "friendAmount", v)} />
        <Num label="Referrer's cashback (₹)" value={config.referral.referrerAmount} onChange={(v) => set("referral", "referrerAmount", v)} />
        <Num label="Friend's minimum first order (₹)" value={config.referral.minOrder} onChange={(v) => set("referral", "minOrder", v)} />
        <Num label="Max rewards per customer" value={config.referral.maxRewards} onChange={(v) => set("referral", "maxRewards", v)} />
      </Card>

      <Card icon={Gift} title="Welcome offer (first order)" enabled={config.welcome.enabled} onToggle={(v) => set("welcome", "enabled", v)} onSave={() => void save("welcome")} saving={saving === "welcome"}>
        <Num label="Discount (₹)" value={config.welcome.amount} onChange={(v) => set("welcome", "amount", v)} />
        <Num label="Minimum order (₹)" value={config.welcome.minOrder} onChange={(v) => set("welcome", "minOrder", v)} />
      </Card>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  enabled,
  onToggle,
  onSave,
  saving,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border-soft bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-base font-semibold"><Icon className="h-5 w-5 text-brand-strong" /> {title}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={enabled} onChange={(e) => onToggle(e.target.checked)} /> On
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      <Button size="sm" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </section>
  );
}

function Num({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-10 w-full rounded-lg border border-border-soft bg-background px-3"
      />
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
