"use client";

import * as React from "react";
import { trackSiteEvent, type SiteEventType } from "@/services/site-analytics";

/** Reports one storefront analytics event when mounted. Renders nothing. */
export function TrackSiteEvent({ type, productId }: { type: SiteEventType; productId?: string }) {
  React.useEffect(() => {
    trackSiteEvent(type, productId);
  }, [type, productId]);
  return null;
}
