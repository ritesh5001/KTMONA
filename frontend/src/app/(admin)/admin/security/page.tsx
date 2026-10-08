"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { getAuditLogs } from "@/services/admin";
import { toast } from "sonner";

export default function AdminSecurityPage() {
  const [loading, setLoading] = React.useState(true);
  const [logs, setLogs] = React.useState<Array<any>>([]);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await getAuditLogs();
        setLogs(result.auditLogs ?? []);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to load audit logs"
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 lg:py-20"
      >
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Platform Security
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Audit Trail
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Track administrative actions and compliance events with full transparency.
          </p>
        </div>

        {/* Audit Logs */}
        <section className="space-y-4">
          {loading ? (
            <div className="border border-border-soft bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="border border-border-soft bg-card p-12 text-center space-y-2">
              <p className="font-serif text-lg font-light text-foreground">
                No Activity
              </p>
              <p className="text-sm text-muted-foreground">
                No audit logs found.
              </p>
            </div>
          ) : (
            logs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.03, duration: 0.4 }}
                className="border border-border-soft bg-card"
              >
                {/* Log Header */}
                <div className="flex items-center justify-between gap-4 p-6 border-b border-border-soft">
                  <p className="font-medium text-foreground">
                    {log.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                      : "—"}
                  </p>
                </div>

                {/* Log Details */}
                <div className="grid gap-px bg-border-soft sm:grid-cols-3">
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Entity
                    </p>
                    <p className="font-medium text-foreground">
                      {log.entityType} · <span className="font-mono text-sm">{log.entityId?.slice(0, 8).toUpperCase()}</span>
                    </p>
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Actor
                    </p>
                    <p className="font-medium text-foreground font-mono text-sm">
                      {log.actorId?.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Metadata
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : "—"}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </section>
      </motion.div>
    </div>
  );
}
