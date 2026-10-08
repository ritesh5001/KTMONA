/**
 * Audit Service
 * Business logic for audit logging
 */
import { AuditRepository, AuditLogFilters, AuditLogResult, AuditEntityType } from '../repositories/audit.repository.js';
/**
 * Audit Service Class
 * Handles audit logging business logic
 */
export declare class AuditService {
    private readonly auditRepo;
    constructor(auditRepo: AuditRepository);
    /**
     * Log an admin action
     * This should be called for every admin action
     */
    logAction(actorId: string, action: string, entityType: AuditEntityType, entityId: string, metadata?: Record<string, unknown>): Promise<AuditLogResult>;
    /**
     * Get audit logs with filters
     */
    getAuditLogs(filters?: AuditLogFilters): Promise<{
        auditLogs: AuditLogResult[];
    }>;
    /**
     * Get audit history for a specific entity
     */
    getEntityHistory(entityType: AuditEntityType, entityId: string): Promise<{
        auditLogs: AuditLogResult[];
    }>;
}
export declare const auditService: AuditService;
//# sourceMappingURL=audit.service.d.ts.map