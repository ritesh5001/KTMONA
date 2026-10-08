import type { Role } from '@prisma/client';
export type DashboardEventType = 'product.updated' | 'inventory.updated' | 'order.updated' | 'shipment.updated' | 'payment.updated' | 'catalog.updated' | 'support.message' | 'support.ticket.updated';
export interface LiveEventAudience {
    allAuthenticated?: boolean;
    roles?: Role[];
    userIds?: string[];
}
export interface LiveDashboardEvent {
    type: DashboardEventType;
    tags: string[];
    entityId?: string;
    payload?: Record<string, unknown>;
    audience?: LiveEventAudience;
    occurredAt: string;
}
export declare function onLiveDashboardEvent(listener: (event: LiveDashboardEvent) => void): () => void;
export declare function publishLiveDashboardEvent(input: Omit<LiveDashboardEvent, 'occurredAt'>): Promise<void>;
//# sourceMappingURL=live-events.d.ts.map