import { type DashboardEventType, type LiveEventAudience } from './live-events.js';
export interface FreshnessDispatchInput {
    type: DashboardEventType;
    tags: string[];
    entityId?: string;
    payload?: Record<string, unknown>;
    audience?: LiveEventAudience;
}
export declare function dispatchFreshness(input: FreshnessDispatchInput): Promise<void>;
//# sourceMappingURL=freshness.service.d.ts.map