/**
 * Audit Repository
 * Database operations for audit logs
 */
/**
 * Audit Entity Type - using string literals to match DB enum
 */
export type AuditEntityType = 'USER' | 'PRODUCT' | 'ORDER' | 'PAYMENT';
/**
 * Audit log filters for queries
 */
export interface AuditLogFilters {
    entityType?: AuditEntityType;
    entityId?: string;
    actorId?: string;
    startDate?: Date;
    endDate?: Date;
}
/**
 * Input for creating audit log
 */
export interface CreateAuditLogInput {
    actorId: string;
    action: string;
    entityType: AuditEntityType;
    entityId: string;
    metadata?: Record<string, unknown> | null;
}
/**
 * Audit log response type
 */
export interface AuditLogResult {
    id: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: unknown;
    createdAt: Date;
}
/**
 * Audit Repository Class
 * Handles all audit log database operations
 */
export declare class AuditRepository {
    /**
     * Create a new audit log entry
     */
    create(data: CreateAuditLogInput): Promise<AuditLogResult>;
    /**
     * Find audit logs with optional filters
     */
    findAll(filters?: AuditLogFilters): Promise<AuditLogResult[]>;
    /**
     * Find audit logs by entity
     */
    findByEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLogResult[]>;
}
export declare const auditRepository: AuditRepository;
//# sourceMappingURL=audit.repository.d.ts.map