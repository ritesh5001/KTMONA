import { dedupeTags } from './cache-tags.js';
import { publishLiveDashboardEvent } from './live-events.js';
import { triggerFrontendRevalidation } from './revalidate.service.js';
export async function dispatchFreshness(input) {
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
//# sourceMappingURL=freshness.service.js.map