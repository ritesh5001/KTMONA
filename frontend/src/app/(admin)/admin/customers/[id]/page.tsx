"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, Ban, CheckCircle2, Heart, IndianRupee, MapPin, RotateCcw, ShoppingBag, ShoppingCart, Star, Trash2, XCircle } from "lucide-react";
import { adminCenter, type AdminCustomerDetail } from "@/services/admin-center";
import { inr, fmtDate, shortId } from "@/services/seller-center";
import { Badge, Btn, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, Panel, StatCard, StatusBadge, errorMessage, inputCls } from "@/components/seller/kit";
import { ReasonDialog } from "@/components/admin/ReasonDialog";

type Dialog = null | "suspend" | "delete";

export default function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: c, error, isLoading, mutate } = useSWR(["admin-customer", id], () => adminCenter.customer(id));
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<AdminCustomerDetail>, message: string) => {
    setBusy(key);
    try {
      mutate(await fn(), { revalidate: false });
      toast.success(message);
      setDialog(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (error && !c) return <div className="p-6"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>;
  if (isLoading || !c) return <Loading rows={8} />;

  const statusTone = c.status === "ACTIVE" ? "green" : c.status === "PENDING" ? "orange" : "red";
  const contact = [c.email, c.phone].filter(Boolean).join(" · ");

  return (
    <PageShell>
      <PageHeader
        breadcrumb={{ label: "Customers", href: "/admin/customers" }}
        title={c.name ?? "Customer without a name"}
        description={`${contact || "No contact details"} · joined ${fmtDate(c.joinedAt)}`}
        actions={
          <>
            <Badge tone={statusTone}>{c.status}</Badge>
            {c.status === "SUSPENDED" ? (
              <Btn variant="brand" loading={busy === "reactivate"} onClick={() => act("reactivate", () => adminCenter.setCustomerStatus(c.id, "ACTIVE", "Reactivated by admin"), "Customer reactivated")}>Reactivate</Btn>
            ) : (
              <Btn variant="danger" onClick={() => setDialog("suspend")}>Suspend</Btn>
            )}
            <Btn variant="outline" onClick={() => setDialog("delete")}><Trash2 className="h-4 w-4" /> Delete permanently</Btn>
          </>
        }
      />

      {c.status === "SUSPENDED" ? (
        <div className="flex gap-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Suspended{c.suspendedAt ? ` on ${fmtDate(c.suspendedAt)}` : ""}{c.statusReason ? `: ${c.statusReason}` : ""}. The customer is signed out and cannot log in or place orders.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} tone="blue" label="Total spent" value={inr.format(c.stats.spent)} sub={`${c.stats.orders} order${c.stats.orders === 1 ? "" : "s"} placed`} />
        <StatCard icon={RotateCcw} tone="amber" label="Returns" value={c.stats.returns} sub={`${c.stats.cancellations} cancellation request${c.stats.cancellations === 1 ? "" : "s"}`} />
        <StatCard icon={Star} tone="navy" label="Reviews" value={c.stats.reviews} />
        <StatCard icon={ShoppingCart} tone="green" label="In cart" value={c.stats.cart} sub={<span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{c.stats.wishlist} in wishlist</span>} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Customer details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt><dd className="font-medium">{c.name ?? "—"}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium">{c.email ?? "—"}{c.email ? <Verified ok={c.emailVerified} /> : null}</dd>
            <dt className="text-muted-foreground">Mobile</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium">{c.phone ?? "—"}{c.phone ? <Verified ok={c.phoneVerified} /> : null}</dd>
            {c.whatsapp ? (<><dt className="text-muted-foreground">WhatsApp</dt><dd className="font-medium">{c.whatsapp}</dd></>) : null}
            <dt className="text-muted-foreground">State</dt><dd className="font-medium">{c.state ?? "—"}</dd>
            {c.gender ? (<><dt className="text-muted-foreground">Gender</dt><dd className="font-medium capitalize">{c.gender.toLowerCase()}</dd></>) : null}
            {c.dob ? (<><dt className="text-muted-foreground">Date of birth</dt><dd className="font-medium">{fmtDate(c.dob)}</dd></>) : null}
            <dt className="text-muted-foreground">Joined</dt><dd className="font-medium">{fmtDate(c.joinedAt, true)}</dd>
            <dt className="text-muted-foreground">Last login</dt><dd className="font-medium">{c.lastLoginAt ? fmtDate(c.lastLoginAt, true) : "—"}</dd>
            <dt className="text-muted-foreground">Customer ID</dt><dd className="font-mono text-xs">{c.id}</dd>
          </dl>
        </Panel>

        <div className="space-y-5">
          <Panel title="Cash on Delivery" action={c.codDisabled ? <Badge tone="red"><Ban className="mr-1 h-3 w-3" />Off</Badge> : <Badge tone="green">On</Badge>}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                {c.codDisabled
                  ? "Off: this customer can only pay online. COD is hidden at checkout."
                  : "On: this customer can choose Cash on Delivery (when COD is on for the platform)."}
              </p>
              <Btn
                size="sm"
                variant={c.codDisabled ? "brand" : "danger"}
                loading={busy === "cod"}
                onClick={() => act("cod", () => adminCenter.setCustomerCod(c.id, !c.codDisabled), c.codDisabled ? "COD turned back on for this customer" : "COD turned off for this customer")}
              >
                {c.codDisabled ? "Turn COD on" : "Turn COD off"}
              </Btn>
            </div>
          </Panel>

          <Panel title="Saved addresses">
            {c.addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {c.addresses.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p>{[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ")}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.label.toLowerCase()}</p>
                    </div>
                    {a.isDefault ? <Badge tone="green">Default</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </section>

      <Panel title="Orders" padded={false} action={<span className="text-xs text-muted-foreground">Latest 20</span>}>
        {c.recentOrders.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Items</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Payment</th>
                  <th className="px-3 py-3 font-semibold">City</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {c.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border-soft last:border-0">
                    <td className="px-5 py-3 font-semibold">{shortId(o.id)}<p className="text-xs font-normal text-muted-foreground">{fmtDate(o.createdAt, true)}</p></td>
                    <td className="px-3 py-3 tabular-nums">{o.items}</td>
                    <td className="px-3 py-3 tabular-nums">{inr.format(o.amount)}</td>
                    <td className="px-3 py-3 text-xs">{o.paymentMethod === "COD" ? "Cash on Delivery" : "Online"}</td>
                    <td className="px-3 py-3 text-xs">{o.city ?? "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ReasonDialog
        open={dialog === "suspend"}
        title="Suspend customer"
        label="Reason"
        presets={["Fake / fraudulent orders", "Repeated COD refusals (RTO)", "Abusive behaviour", "Return / refund abuse"]}
        confirm="Suspend & sign out"
        busy={busy === "suspend"}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => act("suspend", () => adminCenter.setCustomerStatus(c.id, "SUSPENDED", reason), "Customer suspended and signed out")}
      >
        <p className="text-xs text-muted-foreground">The customer is signed out of every device and cannot log in or order until you reactivate the account.</p>
      </ReasonDialog>

      <DeleteCustomerDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        identifier={c.email ?? c.phone ?? ""}
        name={c.name}
        busy={busy === "delete"}
        onConfirm={async (confirm) => {
          setBusy("delete");
          try {
            await adminCenter.deleteCustomer(c.id, confirm);
            toast.success("Customer deleted permanently");
            router.replace("/admin/customers");
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(null);
          }
        }}
      />
    </PageShell>
  );
}

function Verified({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Verified</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><XCircle className="h-3.5 w-3.5" />Not verified</span>
  );
}

function DeleteCustomerDialog({ open, onClose, identifier, name, busy, onConfirm }: { open: boolean; onClose: () => void; identifier: string; name: string | null; busy: boolean; onConfirm: (confirm: string) => void }) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const matches = identifier !== "" && typed.trim().toLowerCase() === identifier.trim().toLowerCase();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete customer permanently?"
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="danger" loading={busy} disabled={!matches} onClick={() => onConfirm(typed)}>Delete permanently</Btn></>}
    >
      <div className="space-y-4 text-sm">
        <p>
          This removes {name ? <strong>{name}</strong> : "this customer"}&apos;s account, profile, addresses, cart, wishlist and reviews for good. It cannot be undone. The same email or mobile number can then be used to sign up again.
        </p>
        <p className="flex gap-2 text-muted-foreground">
          <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0" />
          Past orders stay on record for invoices and seller settlements. A customer with an order in progress or an open return / cancellation cannot be deleted yet; suspend them instead.
        </p>
        <Field label={`Type ${identifier} to confirm`}>
          <input className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={identifier} autoComplete="off" />
        </Field>
      </div>
    </Modal>
  );
}
