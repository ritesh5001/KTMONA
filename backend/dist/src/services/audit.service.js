/**
 * Audit Service
 * Business logic for audit logging
 */
import { auditRepository } from '../repositories/audit.repository.js';
/**
 * Audit Service Class
 * Handles audit logging business logic
 */
export class AuditService {
    auditRepo;
    constructor(auditRepo) {
        this.auditRepo = auditRepo;
    }
    /**
     * Log an admin action
     * This should be called for every admin action
     */
    async logAction(actorId, action, entityType, entityId, metadata) {
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
    async getAuditLogs(filters = {}) {
        const auditLogs = await this.auditRepo.findAll(filters);
        return { auditLogs };
    }
    /**
     * Get audit history for a specific entity
     */
    async getEntityHistory(entityType, entityId) {
        const auditLogs = await this.auditRepo.findByEntity(entityType, entityId);
        return { auditLogs };
    }
}
// Export singleton instance
export const auditService = new AuditService(auditRepository);
//# sourceMappingURL=audit.service.js.map