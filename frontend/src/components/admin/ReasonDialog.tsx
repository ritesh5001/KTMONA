"use client";

import * as React from "react";
import { Btn, Field, Modal, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

/** Confirm dialog with one-click reason presets and a free-text reason. */
export function ReasonDialog({ open, title, label, presets, confirm, busy, onClose, onConfirm }: { open: boolean; title: string; label: string; presets: string[]; confirm: string; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = React.useState("");
  React.useEffect(() => setReason(presets[0] ?? ""), [open, presets]);
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>{confirm}</Btn></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => setReason(p)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", reason === p ? "border-ink bg-ink text-paper dark:border-brand dark:bg-brand dark:text-ink" : "border-border-soft hover:bg-mist")}>{p}</button>
          ))}
        </div>
        <Field label={label}><textarea rows={3} className={`${inputCls} h-auto py-2`} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
