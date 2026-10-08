"use client";
import { getAccessToken } from "@/lib/session";

import * as React from "react";

export type LiveFreshnessEventType =
  | "product.updated"
  | "inventory.updated"
  | "order.updated"
  | "shipment.updated"
  | "payment.updated"
  | "catalog.updated"
  | "support.message"
  | "support.ticket.updated";

export interface LiveFreshnessEvent {
  type: LiveFreshnessEventType;
  tags: string[];
  entityId?: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
}



export function useLiveFreshness(options: {
  enabled?: boolean;
  eventTypes: LiveFreshnessEventType[];
  onEvent: (event: LiveFreshnessEvent) => void;
}) {
  const { enabled = true, eventTypes, onEvent } = options;
  const onEventRef = React.useRef(onEvent);

  React.useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  React.useEffect(() => {
    if (!enabled) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) return;

    const token = getAccessToken();
    if (!token) return;

    const source = new EventSource(
      `${apiBaseUrl}/v1/live/events?accessToken=${encodeURIComponent(token)}`,
    );

    const listeners: Array<{ type: string; handler: (event: MessageEvent) => void }> = [];

    for (const type of eventTypes) {
      const handler = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as LiveFreshnessEvent;
          onEventRef.current(parsed);
        } catch {
          // Ignore malformed events.
        }
      };

      source.addEventListener(type, handler);
      listeners.push({ type, handler });
    }

    return () => {
      for (const { type, handler } of listeners) {
        source.removeEventListener(type, handler);
      }
      source.close();
    };
  }, [enabled, eventTypes]);
}
