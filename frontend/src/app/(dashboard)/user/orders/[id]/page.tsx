"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrderTracking } from "@/services/shipments";
import { toast } from "sonner";

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [loading, setLoading] = React.useState(true);
  const [tracking, setTracking] = React.useState<{
    orderId: string;
    status: string;
    shipments: Array<{
      id: string;
      carrier: string;
      trackingNumber: string;
      status: string;
      shippedAt?: string | null;
      deliveredAt?: string | null;
      events: Array<{ status: string; note?: string | null; createdAt: string }>;
    }>;
  } | null>(null);

  React.useEffect(() => {
    const load = async () => {
      if (!orderId) return;
      setLoading(true);
      try {
        const result = await getOrderTracking(orderId);
        setTracking(result.data ?? null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to load tracking"
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId]);

  if (!orderId) {
    return (
      <div className="min-h-[50vh]">
        <div className="flex w-full max-w-4xl flex-col gap-6">
          <Card className="border border-border-soft bg-card">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Order not found.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[50vh]">
      <div className="flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-strong">
              Order tracking
            </p>
            <h1 className="text-3xl font-semibold text-foreground">
              Track order {orderId.slice(0, 8).toUpperCase()}
            </h1>
          </div>
          <Button variant="outline" onClick={() => router.push("/user/orders")}
          >
            Back to orders
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading tracking...</p>
        ) : !tracking ? (
          <Card className="border border-border-soft bg-card">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Tracking details unavailable.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <Card className="border border-border-soft bg-card">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">
                  Current status
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Order status: <span className="font-semibold text-foreground">{tracking.status}</span>
              </CardContent>
            </Card>

            {tracking.shipments.length === 0 ? (
              <Card className="border border-border-soft bg-card">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Shipment not created yet.
                </CardContent>
              </Card>
            ) : (
              tracking.shipments.map((shipment) => (
                <Card
                  key={shipment.id}
                  className="border border-border-soft bg-card"
                >
                  <CardHeader>
                    <CardTitle className="text-lg text-foreground">
                      {shipment.carrier} · {shipment.trackingNumber}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-brand-strong">
                        {shipment.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {shipment.shippedAt
                          ? `Shipped ${new Date(shipment.shippedAt).toLocaleDateString("en-IN")}`
                          : shipment.deliveredAt
                          ? `Delivered ${new Date(shipment.deliveredAt).toLocaleDateString("en-IN")}`
                          : ""}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Timeline
                      </p>
                      {shipment.events.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No events yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {shipment.events.map((event, index) => (
                            <li
                              key={`${shipment.id}-${index}`}
                              className="rounded-xl border border-border-soft bg-background px-4 py-3"
                            >
                              <p className="font-semibold text-foreground">
                                {event.status}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(event.createdAt).toLocaleString("en-IN")}
                              </p>
                              {event.note ? (
                                <p className="text-xs text-muted-foreground">{event.note}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
