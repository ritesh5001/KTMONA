"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  listSellerAppointments,
  updateAppointmentStatus,
  type Appointment,
} from "@/services/appointments";
import { toast } from "sonner";
import { useHydratedSWR } from "@/hooks/use-hydrated-swr";

function formatDateLabel(appointment: Appointment): string {
  return new Date(appointment.date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getWhatsappLink(appointment: Appointment): string {
  if (appointment.whatsappLink) return appointment.whatsappLink;
  return `https://wa.me/${appointment.whatsappNumber}`;
}

function getStartDate(appointment: Appointment): Date {
  const datePart = appointment.date.slice(0, 10);
  return new Date(`${datePart}T${appointment.time}:00`);
}

function isJoinActive(appointment: Appointment, now: Date): boolean {
  if (typeof appointment.joinActive === "boolean") return appointment.joinActive;
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") return false;

  const start = getStartDate(appointment).getTime();
  const openAt = start - 10 * 60 * 1000;
  const closeAt = start + 60 * 60 * 1000;
  const nowMs = now.getTime();

  return nowMs >= openAt && nowMs <= closeAt;
}

export default function SellerAppointmentsPage() {
  // Cached so returning to this tab is instant instead of a fresh cold request.
  const {
    data: appointments = [],
    isLoading: loading,
    mutate: mutateAppointments,
  } = useHydratedSWR<Appointment[]>({
    key: "seller-appointments",
    fetcher: async () => (await listSellerAppointments()).appointments ?? [],
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to load appointments"
      );
    },
  });
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const hasSoonReminder = appointments.some((appointment) => {
    if (typeof appointment.callStartsSoon === "boolean") return appointment.callStartsSoon;
    const start = getStartDate(appointment).getTime();
    const nowMs = now.getTime();
    return nowMs >= start - 10 * 60 * 1000 && nowMs < start;
  });

  const pendingCount = appointments.filter((appointment) => appointment.status === "PENDING").length;

  const handleStatusUpdate = React.useCallback(
    async (appointmentId: string, status: "CONFIRMED" | "CANCELLED") => {
      setUpdatingId(appointmentId);
      try {
        const result = await updateAppointmentStatus(appointmentId, status);
        void mutateAppointments(
          (prev) =>
            (prev ?? []).map((item) =>
              item.id === appointmentId ? result.appointment : item
            ),
          { revalidate: false }
        );
        toast.success(`Appointment ${status.toLowerCase()}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update appointment");
      } finally {
        setUpdatingId(null);
      }
    },
    [mutateAppointments],
  );

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 lg:py-20"
      >
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Seller Consultations
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Appointments
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            View customer video appointments and confirm or cancel slots.
          </p>
        </div>

        <section className="space-y-4">
          {pendingCount > 0 && (
            <div className="border border-blue-300/40 bg-blue-50/60 p-4 text-sm text-blue-900">
              Alert: You have {pendingCount} new appointment{pendingCount > 1 ? "s" : ""} awaiting action.
            </div>
          )}

          {hasSoonReminder && (
            <div className="border border-brand/30 bg-brand/10 p-4 text-sm text-foreground">
              Call starts soon. Open WhatsApp from the active appointment row.
            </div>
          )}

          {loading ? (
            <div className="border border-border-soft bg-card p-10 text-center text-sm text-muted-foreground">
              Loading appointments...
            </div>
          ) : appointments.length === 0 ? (
            <div className="border border-border-soft bg-card p-10 text-center text-sm text-muted-foreground">
              No appointments found.
            </div>
          ) : (
            appointments.map((appointment, index) => {
              const customer = appointment.user?.email || appointment.user?.phone || appointment.userId;
              const canManage = appointment.status !== "COMPLETED" && appointment.status !== "CANCELLED";
              const canConfirm = appointment.status === "PENDING";
              const canJoin = isJoinActive(appointment, now);

              return (
                <motion.div
                  key={appointment.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.35 }}
                  className="border border-border-soft bg-card p-6"
                >
                  <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr_0.9fr_auto] lg:items-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">User</p>
                      <p className="mt-1 text-sm font-medium text-foreground break-all">{customer}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Date</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{formatDateLabel(appointment)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Time</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{appointment.time}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Product</p>
                      <p className="mt-1 text-sm font-medium text-foreground truncate">
                        {appointment.product?.title || "General Consultation"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                      <span className="mt-1 inline-flex border border-border-soft px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground">
                        {appointment.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <a
                        href={canJoin ? getWhatsappLink(appointment) : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex h-9 items-center justify-center border px-3 text-[10px] font-medium uppercase tracking-[0.12em] ${
                          canJoin
                            ? "border-border-soft text-foreground hover:bg-mist"
                            : "cursor-not-allowed border-border-soft text-muted-foreground"
                        }`}
                        onClick={(event) => {
                          if (!canJoin) {
                            event.preventDefault();
                            toast.message("Join is active 10 minutes before the slot and up to 1 hour after start.");
                          }
                        }}
                      >
                        Join Call
                      </a>
                      <Button
                        size="sm"
                        disabled={!canManage || !canConfirm || updatingId === appointment.id}
                        onClick={() => handleStatusUpdate(appointment.id, "CONFIRMED")}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManage || updatingId === appointment.id}
                        onClick={() => handleStatusUpdate(appointment.id, "CANCELLED")}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </section>
      </motion.div>
    </div>
  );
}
