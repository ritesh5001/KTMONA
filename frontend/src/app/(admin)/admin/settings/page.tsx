"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  getShippingSetting,
  updateShippingSetting,
  getGstSetting,
  updateGstSetting,
  getCodSetting,
  updateCodSetting,
  updateFreeDeliveryThreshold,
} from "@/services/admin";
import { toast } from "sonner";
import { Truck, Receipt, Banknote, Gift, type LucideIcon } from "lucide-react";

interface ChargeSetting {
  enabled: boolean;
  amount: number;
}

interface ChargeToggleCardProps {
  icon: LucideIcon;
  title: string;
  /** Renders the descriptive copy given the resolved fee amount. */
  renderDescription: (amount: number) => React.ReactNode;
  /** Label shown in the status pill when the charge is off. */
  offLabel: string;
  fallbackAmount: number;
  load: () => Promise<ChargeSetting>;
  save: (enabled: boolean) => Promise<ChargeSetting>;
  successLabel: string;
  errorLabel: string;
  /** Button text; defaults to "Start charge" / "Stop charge". */
  enableLabel?: string;
  disableLabel?: string;
}

function ChargeToggleCard({
  icon: Icon,
  title,
  renderDescription,
  offLabel,
  fallbackAmount,
  load,
  save,
  successLabel,
  errorLabel,
  enableLabel = "Start charge",
  disableLabel = "Stop charge",
}: ChargeToggleCardProps) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [setting, setSetting] = React.useState<ChargeSetting | null>(null);

  const loadSetting = React.useCallback(async () => {
    setLoading(true);
    try {
      setSetting(await load());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load settings"
      );
    } finally {
      setLoading(false);
    }
  }, [load]);

  React.useEffect(() => {
    loadSetting();
  }, [loadSetting]);

  const handleToggle = async (next: boolean) => {
    if (saving || !setting) return;
    setSaving(true);
    setSetting((prev) => (prev ? { ...prev, enabled: next } : prev));
    try {
      setSetting(await save(next));
      toast.success(`${successLabel} ${next ? "enabled" : "disabled"}`);
    } catch (error) {
      setSetting((prev) => (prev ? { ...prev, enabled: !next } : prev));
      toast.error(error instanceof Error ? error.message : errorLabel);
    } finally {
      setSaving(false);
    }
  };

  const enabled = setting?.enabled ?? false;
  const amount = setting?.amount ?? fallbackAmount;

  return (
    <section className="border border-border-soft bg-card p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex gap-4">
          <div className="mt-0.5 text-brand-strong">
            <Icon className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-medium text-foreground">{title}</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {renderDescription(amount)}
            </p>
            <div className="mt-3">
              {loading ? (
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Loading…
                </span>
              ) : (
                <span
                  className={
                    "inline-flex items-center gap-2 border px-2 py-1 text-xs font-medium uppercase tracking-wider " +
                    (enabled
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                      : "border-border-soft bg-mist text-muted-foreground")
                  }
                >
                  <span
                    className={
                      "h-2 w-2 rounded-full " +
                      (enabled ? "bg-emerald-500" : "bg-muted-foreground/50")
                    }
                  />
                  {enabled ? "Active" : offLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant={enabled ? "outline" : "primary"}
          disabled={loading || saving}
          onClick={() => handleToggle(!enabled)}
          className="shrink-0"
        >
          {saving ? "Saving…" : enabled ? disableLabel : enableLabel}
        </Button>
      </div>
    </section>
  );
}

/** Free delivery above an order value ("Add ₹X more for FREE delivery"). */
function FreeDeliveryCard() {
  const [value, setValue] = React.useState("");
  const [current, setCurrent] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    getShippingSetting()
      .then((s) => {
        setCurrent(s.freeAbove ?? 0);
        setValue(s.freeAbove ? String(s.freeAbove) : "");
      })
      .catch(() => setCurrent(0));
  }, []);

  const save = async (amount: number) => {
    setSaving(true);
    try {
      const s = await updateFreeDeliveryThreshold(amount);
      setCurrent(s.freeAbove ?? 0);
      setValue(s.freeAbove ? String(s.freeAbove) : "");
      toast.success(s.freeAbove ? `Free delivery above ₹${s.freeAbove}` : "Free-delivery offer turned off");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border-soft bg-card p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-strong">
          <Gift className="h-5 w-5" />
        </span>
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Free delivery offer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Orders whose value (after coupons, before GST) reaches this amount ship free. Shoppers see
              “Add ₹X more for FREE delivery” in the cart. Leave empty or 0 to turn the offer off.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Now: {current === null ? "…" : current > 0 ? `free above ₹${current}` : "off"}
            </p>
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save(Number(value) || 0);
            }}
          >
            <span className="text-sm text-muted-foreground">₹</span>
            <input
              aria-label="Free delivery above (₹)"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 499"
              className="h-10 w-32 rounded-lg border border-border-soft bg-background px-3 text-sm"
            />
            <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            {current ? (
              <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void save(0)}>Turn off</Button>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide configuration for the storefront and checkout.
        </p>
      </header>

      <div className="space-y-6">
        <ChargeToggleCard
          icon={Truck}
          title="Shipping Charge"
          offLabel="Free shipping"
          fallbackAmount={180}
          load={getShippingSetting}
          save={updateShippingSetting}
          successLabel="Shipping charge"
          errorLabel="Unable to update shipping charge"
          renderDescription={(amount) => (
            <>
              When enabled, a flat shipping fee of{" "}
              <span className="font-medium text-foreground">₹{amount}</span> is
              added to every order at checkout. Turn it off to offer free
              shipping — new orders will not be charged.
            </>
          )}
        />

        <FreeDeliveryCard />

        <ChargeToggleCard
          icon={Receipt}
          title="GST Charge"
          offLabel="No GST fee"
          fallbackAmount={180}
          load={getGstSetting}
          save={updateGstSetting}
          successLabel="GST charge"
          errorLabel="Unable to update GST charge"
          renderDescription={(amount) => (
            <>
              When enabled, a flat GST fee of{" "}
              <span className="font-medium text-foreground">₹{amount}</span> per
              item is added to every order at checkout. Turn it off to remove
              the flat GST fee — new orders will not be charged.
            </>
          )}
        />

        <ChargeToggleCard
          icon={Banknote}
          title="Cash on Delivery"
          offLabel="Online payment only"
          fallbackAmount={50000}
          load={getCodSetting}
          save={updateCodSetting}
          successLabel="Cash on Delivery"
          errorLabel="Unable to update Cash on Delivery"
          enableLabel="Turn on COD"
          disableLabel="Turn off COD"
          renderDescription={(amount) => (
            <>
              When enabled, shoppers can choose Cash on Delivery at checkout on
              the website and the app for orders up to{" "}
              <span className="font-medium text-foreground">₹{amount.toLocaleString("en-IN")}</span>.
              The order is confirmed straight away and the courier collects the
              cash. Turn it off to accept online payments only.
            </>
          )}
        />
      </div>
    </div>
  );
}
