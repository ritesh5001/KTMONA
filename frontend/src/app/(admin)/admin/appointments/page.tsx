"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminBlockSeller,
  adminRescheduleAppointment,
  listAdminAppointments,
  updateAppointmentStatus,
  type Appointment,
} from "@/services/appointments";
import { toast } from "sonner";

function formatDateLabel(appointment: Appointment): string {
  return new Date(appointment.date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = React.useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = React.useState("");
  const [rescheduleTime, setRescheduleTime] = React.useState("");

  const loadAppointments = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAdminAppointments();
      setAppointments(result.appointments ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleCancel = async (appointmentId: string) => {
    setBusyId(appointmentId);
    try {
      const result = await updateAppointmentStatus(appointmentId, "CANCELLED");
      setAppointments((prev) => prev.map((item) => (item.id === appointmentId ? result.appointment : item)));
      toast.success("Appointment cancelled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel appointment");
    } finally {
      setBusyId(null);
    }
  };

  const handleBlockSeller = async (sellerId: string, appointmentId: string) => {
    setBusyId(appointmentId);
    try {
      const result = await adminBlockSeller(sellerId);
      toast.success(`${result.message} (${result.cancelledAppointments} updated)`);
      loadAppointments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to block seller");
    } finally {
      setBusyId(null);
    }
  };

  const openReschedule = (appointment: Appointment) => {
    setRescheduleTarget(appointment);
    setRescheduleDate(appointment.date.slice(0, 10));
    setRescheduleTime(appointment.time);
  };

  const submitReschedule = async () => {
    if (!rescheduleTarget) return;
    if (!rescheduleDate || !rescheduleTime) {
      toast.error("Please select date and time.");
      return;
    }

    setBusyId(rescheduleTarget.id);
    try {
      const result = await adminRescheduleAppointment({
        appointmentId: rescheduleTarget.id,
        date: rescheduleDate,
        time: rescheduleTime,
      });
      setAppointments((prev) =>
        prev.map((item) => (item.id === rescheduleTarget.id ? result.appointment : item)),
      );
      toast.success("Appointment rescheduled.");
      setRescheduleTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reschedule appointment");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = appointments.filter((item) => {
    const q = query.trim().toLowerCase();
    const sellerName = item.seller?.seller_profiles?.store_name ?? item.seller?.email ?? item.sellerId;
    const userName = item.user?.email ?? item.user?.phone ?? item.userId;
    const productTitle = item.product?.title ?? "";

    const matchesText =
      !q ||
      item.id.toLowerCase().includes(q) ||
      sellerName.toLowerCase().includes(q) ||
      userName.toLowerCase().includes(q) ||
      productTitle.toLowerCase().includes(q);

    const matchesStatus = !statusFilter || item.status === statusFilter;
    return matchesText && matchesStatus;
  });

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-16 lg:py-20"
      >
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">Admin Operations</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Appointments</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Monitor all appointment traffic and take direct actions to keep scheduling reliable.
          </p>
        </div>

        <div className="border border-border-soft bg-card p-4 flex flex-col gap-4 md:flex-row md:items-center">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by appointment, user, seller, product"
            className="md:max-w-md"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 border border-border-soft bg-card px-3 text-sm text-foreground outline-none"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <Button variant="outline" onClick={loadAppointments}>Refresh</Button>
        </div>

        <section className="space-y-4">
          {loading ? (
            <div className="border border-border-soft bg-card p-10 text-center text-sm text-muted-foreground">
              Loading appointments...
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-border-soft bg-card p-10 text-center text-sm text-muted-foreground">
              No appointments found.
            </div>
          ) : (
            filtered.map((item, index) => {
              const sellerName = item.seller?.seller_profiles?.store_name ?? item.seller?.email ?? item.sellerId;
              const userName = item.user?.email ?? item.user?.phone ?? item.userId;
              const canAct = item.status !== "COMPLETED" && item.status !== "CANCELLED";

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.35 }}
                  className="border border-border-soft bg-card p-6"
                >
                  <div className="grid gap-5 xl:grid-cols-[1.1fr_1.1fr_0.8fr_0.8fr_1fr_0.8fr_auto] xl:items-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">User</p>
                      <p className="mt-1 text-sm font-medium text-foreground break-all">{userName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Seller</p>
                      <p className="mt-1 text-sm font-medium text-foreground break-all">{sellerName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Date</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{formatDateLabel(item)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Time</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{item.time}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Product</p>
                      <p className="mt-1 text-sm font-medium text-foreground truncate">
                        {item.product?.title || "General Consultation"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                      <span className="mt-1 inline-flex border border-border-soft px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground">
                        {item.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canAct || busyId === item.id}
                        onClick={() => handleCancel(item.id)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canAct || busyId === item.id}
                        onClick={() => openReschedule(item)}
                      >
                        Reschedule
                      </Button>
                      <Button
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => handleBlockSeller(item.sellerId, item.id)}
                      >
                        Block Seller
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </section>
      </motion.div>

      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md border border-border-soft bg-card p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-foreground">Reschedule Appointment</h3>
            <p className="mt-2 text-sm text-muted-foreground">Set new date and time for this appointment.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Date</label>
                <Input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Time</label>
                <Input
                  type="time"
                  value={rescheduleTime}
                  onChange={(event) => setRescheduleTime(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setRescheduleTarget(null)}>
                Close
              </Button>
              <Button className="flex-1" onClick={submitReschedule}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
