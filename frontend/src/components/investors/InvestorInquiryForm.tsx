"use client";

import * as React from "react";
import { toast } from "sonner";
import { siteApi } from "@/services/platform";
import { Btn, Field, inputCls } from "@/components/seller/kit";

export function InvestorInquiryForm() {
  const empty = { name: "", email: "", phone: "", organization: "", message: "" };
  const [f, setF] = React.useState(empty);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      const res = await siteApi.investorInquiry({
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim() || null,
        organization: f.organization.trim() || null,
        message: f.message.trim(),
      });
      setSent(res.message);
      setF(empty);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your enquiry");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-5 rounded-xl border border-green-600/25 bg-green-600/5 p-4 text-sm">
        <p className="font-semibold">Enquiry sent</p>
        <p className="mt-1 text-muted-foreground">{sent}</p>
        <button type="button" className="mt-3 font-medium text-brand-strong hover:underline" onClick={() => setSent(null)}>Send another</button>
      </div>
    );
  }

  const valid = f.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.email) && f.message.trim().length >= 10;

  return (
    <form className="mt-5 space-y-4" onSubmit={submit}>
      <Field label="Full name"><input className={inputCls} value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} /></Field>
        <Field label="Mobile (optional)"><input className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} /></Field>
      </div>
      <Field label="Fund / organisation (optional)"><input className={inputCls} value={f.organization} onChange={(e) => setF((p) => ({ ...p, organization: e.target.value }))} /></Field>
      <Field label="Message" hint="At least 10 characters.">
        <textarea rows={5} className={`${inputCls} h-auto py-2`} value={f.message} onChange={(e) => setF((p) => ({ ...p, message: e.target.value }))} />
      </Field>
      <Btn type="submit" variant="brand" className="w-full" loading={sending} disabled={!valid}>Send enquiry</Btn>
    </form>
  );
}
