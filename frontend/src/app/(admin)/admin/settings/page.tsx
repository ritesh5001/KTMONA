"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  getShippingSetting,
  updateShippingSetting,
  getGstSetting,
  updateGstSetting,
} from "@/services/admin";
import { toast } from "sonner";
import { Truck, Receipt, type LucideIcon } from "lucide-react";

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
          {saving ? "Saving…" : enabled ? "Stop charge" : "Start charge"}
        </Button>
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
      </div>
    </div>
  );
}
