import { dedupeTags } from './cache-tags.js';
import { publishLiveDashboardEvent, type DashboardEventType, type LiveEventAudience } from './live-events.js';
import { triggerFrontendRevalidation } from './revalidate.service.js';

export interface FreshnessDispatchInput {
    type: DashboardEventType;
    tags: string[];
    entityId?: string;
    payload?: Record<string, unknown>;
    audience?: LiveEventAudience;
}

export async function dispatchFreshness(input: FreshnessDispatchInput): Promise<void> {
    const tags = dedupeTags(input.tags);
    const eventPayload = {
        type: input.type,
        tags,
        ...(input.entityId ? { entityId: input.entityId } : {}),
        ...(input.payload ? { payload: input.payload } : {}),
        ...(input.audience ? { audience: input.audience } : {}),
    };

    await Promise.allSettled([
        triggerFrontendRevalidation(tags),
        publishLiveDashboardEvent(eventPayload),
    ]);
}
