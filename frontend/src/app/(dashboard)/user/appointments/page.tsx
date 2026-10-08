"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listUserAppointments, type Appointment } from "@/services/appointments";
import { toast } from "sonner";

function getStartDate(appointment: Appointment): Date {
  const datePart = appointment.date.slice(0, 10);
  return new Date(`${datePart}T${appointment.time}:00`);
}

function isJoinActive(appointment: Appointment, now: Date): boolean {
  if (typeof appointment.joinActive === "boolean") {
    return appointment.joinActive;
  }

  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
    return false;
  }

  const start = getStartDate(appointment).getTime();
  const openAt = start - 10 * 60 * 1000;
  const closeAt = start + 60 * 60 * 1000;
  const nowMs = now.getTime();

  return nowMs >= openAt && nowMs <= closeAt;
}

function getWhatsappLink(appointment: Appointment): string {
  if (appointment.whatsappLink) return appointment.whatsappLink;
  return `https://wa.me/${appointment.whatsappNumber}`;
}

function formatDateLabel(appointment: Appointment): string {
  return new Date(appointment.date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UserAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [now, setNow] = React.useState(() => new Date());
  const [bookedAlert, setBookedAlert] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const message = window.localStorage.getItem("ktmona_appointment_alert");
    if (message) {
      setBookedAlert(message);
      window.localStorage.removeItem("ktmona_appointment_alert");
    }
  }, []);

  const hasSoonReminder = appointments.some((appointment) => {
    if (typeof appointment.callStartsSoon === "boolean") {
      return appointment.callStartsSoon;
    }

    const start = getStartDate(appointment).getTime();
    const nowMs = now.getTime();
    return nowMs >= start - 10 * 60 * 1000 && nowMs < start;
  });

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await listUserAppointments();
        setAppointments(result.appointments ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load appointments");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-[50vh]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex w-full flex-col gap-8"
      >
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Video Consultations
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My Appointments
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage your booked video calls with sellers and join directly on WhatsApp.
          </p>
        </div>

        <section className="space-y-4">
          {bookedAlert && (
            <div className="border border-emerald-300/40 bg-emerald-50/60 p-4 text-sm text-emerald-900">
              {bookedAlert}
            </div>
          )}

          {hasSoonReminder && (
            <div className="border border-brand/30 bg-brand/10 p-4 text-sm text-foreground">
              Call starts soon. Your join button is active now.
            </div>
          )}

          {loading ? (
            <div className="border border-border-soft bg-card p-10 text-center text-sm text-muted-foreground">
              Loading appointments...
            </div>
          ) : appointments.length === 0 ? (
            <div className="border border-border-soft bg-card p-10 text-center space-y-4">
              <p className="text-sm text-muted-foreground">No video appointments yet.</p>
              <Link href="/marketplace">
                <Button>Book from Product Page</Button>
              </Link>
            </div>
          ) : (
            appointments.map((appointment, index) => {
              const canJoin = isJoinActive(appointment, now);
              const sellerName =
                appointment.seller?.seller_profiles?.store_name ||
                appointment.seller?.email ||
                "Seller";

              return (
                <motion.div
                  key={appointment.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.35 }}
                  className="border border-border-soft bg-card p-6"
                >
                  <div className="grid gap-4 md:grid-cols-5 md:items-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Date</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{formatDateLabel(appointment)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Time</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{appointment.time}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Seller</p>
                      <p className="mt-1 text-sm font-medium text-foreground truncate">{sellerName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                      <span className="mt-1 inline-flex border border-border-soft px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground">
                        {appointment.status}
                      </span>
                    </div>
                    <div className="md:justify-self-end">
                      <a
                        href={canJoin ? getWhatsappLink(appointment) : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex h-10 items-center justify-center border px-4 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
                          canJoin
                            ? "border-brand/40 bg-brand/5 text-foreground hover:bg-brand/10"
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
