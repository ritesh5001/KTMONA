/**
 * Audit Service
 * Business logic for audit logging
 */

import { AuditRepository, auditRepository, AuditLogFilters, AuditLogResult, AuditEntityType } from '../repositories/audit.repository.js';

/**
 * Audit Service Class
 * Handles audit logging business logic
 */
export class AuditService {
    constructor(private readonly auditRepo: AuditRepository) { }

    /**
     * Log an admin action
     * This should be called for every admin action
     */
    async logAction(
        actorId: string,
        action: string,
        entityType: AuditEntityType,
        entityId: string,
        metadata?: Record<string, unknown>
    ): Promise<AuditLogResult> {
        return this.auditRepo.create({
            actorId,
            action,
            entityType,
            entityId,
            metadata: metadata ?? null,
        });
    }

    /**
     * Get audit logs with filters
     */
    async getAuditLogs(filters: AuditLogFilters = {}): Promise<{ auditLogs: AuditLogResult[] }> {
        const auditLogs = await this.auditRepo.findAll(filters);
        return { auditLogs };
    }

    /**
     * Get audit history for a specific entity
     */
    async getEntityHistory(
        entityType: AuditEntityType,
        entityId: string
    ): Promise<{ auditLogs: AuditLogResult[] }> {
        const auditLogs = await this.auditRepo.findByEntity(entityType, entityId);
        return { auditLogs };
    }
}

// Export singleton instance
export const auditService = new AuditService(auditRepository);
