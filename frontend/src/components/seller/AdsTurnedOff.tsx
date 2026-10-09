import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Btn, Empty, PageHeader, PageShell } from "@/components/seller/kit";

/** Shown at the Ads pages while KTMONA Ads is switched off. */
export function AdsTurnedOff({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <PageShell>
      <PageHeader title="KTMONA Ads" />
      <div className="rounded-2xl border border-border-soft bg-card">
        <Empty
          icon={Megaphone}
          title="Ads are turned off for now"
          text="KTMONA Ads isn't available at the moment. It will be back here when it's switched on."
          action={<Link href={backHref}><Btn variant="outline">{backLabel}</Btn></Link>}
        />
      </div>
    </PageShell>
  );
}
