"use client";

import * as React from "react";
import { Copy, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/components/checkout/PriceBreakup";
import { getReferrals, type ReferralOverview } from "@/services/account";

const STATUS: Record<ReferralOverview["referrals"][number]["status"], { label: string; cls: string }> = {
  SIGNED_UP: { label: "Joined — no order yet", cls: "bg-mist text-foreground" },
  ORDERED: { label: "Ordered — reward after delivery", cls: "bg-amber-50 text-amber-800" },
  REWARDED: { label: "Reward earned", cls: "bg-emerald-50 text-emerald-800" },
  CANCELLED: { label: "Order cancelled / returned", cls: "bg-red-50 text-red-700" },
};

export default function ReferralsPage() {
  const [data, setData] = React.useState<ReferralOverview | null>(null);

  React.useEffect(() => {
    getReferrals().then(setData).catch(() => toast.error("Unable to load your referrals"));
  }, []);

  if (!data) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;

  const message = `Shop on KTMONA and get ₹${data.rules.friendAmount} off your first order with my code ${data.code}: ${data.link}`;
  const copy = (text: string, what: string) => navigator.clipboard?.writeText(text).then(() => toast.success(`${what} copied`)).catch(() => undefined);
  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: "KTMONA", text: message, url: data.link }).catch(() => undefined);
    } else {
      copy(message, "Invite message");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-brand-strong">My Account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Refer & Earn</h1>
        <p className="text-sm text-muted-foreground">
          Friends get {formatInr(data.rules.friendAmount)} off their first order of {formatInr(data.rules.minOrder)}+. You get {formatInr(data.rules.referrerAmount)} cashback when their order is delivered.
        </p>
      </div>

      {!data.enabled ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">The referral program is paused right now.</p> : null}

      <section className="space-y-4 rounded-2xl bg-ink p-6 text-paper">
        <p className="text-xs uppercase tracking-wider opacity-80">Your referral code</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl border border-dashed border-paper/50 px-4 py-2 font-mono text-2xl tracking-widest">{data.code}</span>
          <Button size="sm" variant="secondary" onClick={() => copy(data.code, "Code")}><Copy className="mr-1.5 h-4 w-4" /> Copy code</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => copy(data.link, "Link")}><Copy className="mr-1.5 h-4 w-4" /> Copy link</Button>
          <Button size="sm" variant="secondary" onClick={() => void share()}><Share2 className="mr-1.5 h-4 w-4" /> Share</Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-md bg-[#25D366] px-5 text-xs font-medium text-white"
          >
            Share on WhatsApp
          </a>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Friends joined" value={String(data.stats.joined)} />
        <Stat label="Rewards earned" value={formatInr(data.stats.earned)} />
        <Stat label="Rewards left" value={String(data.stats.remaining)} />
      </div>

      <section className="rounded-2xl border border-border-soft bg-card">
        <h2 className="border-b border-border-soft px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Your referrals</h2>
        {data.referrals.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No one has joined with your code yet. Share it with friends and family.</p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {data.referrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">Joined {new Date(r.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border-soft bg-card p-5 text-xs leading-relaxed text-muted-foreground">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Referral terms</h2>
        <p>• Your friend must sign up with your link or code and place their first order of {formatInr(data.rules.minOrder)} or more.</p>
        <p>• Your {formatInr(data.rules.referrerAmount)} is added as cashback {data.rules.holdDays} days after that order is delivered, if it isn&apos;t returned or cancelled.</p>
        <p>• Up to {data.rules.maxRewards} rewards per customer. Self-referrals and fake accounts are not eligible.</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
