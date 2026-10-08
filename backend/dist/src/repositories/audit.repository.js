/**
 * Audit Repository
 * Database operations for audit logs
 */
import { prisma } from '../config/db.js';
/**
 * Audit Repository Class
 * Handles all audit log database operations
 */
export class AuditRepository {
    /**
     * Create a new audit log entry
     */
    async create(data) {
        // Build create data - omit metadata if null/undefined
        const createPayload = {
            actorId: data.actorId,
            action: data.action,
            entityType: data.entityType,
            entityId: data.entityId,
            ...(data.metadata != null && { metadata: data.metadata }),
        };
        const result = await prisma.auditLog.create({
            data: createPayload,
        });
        return {
            id: result.id,
            actorId: result.actorId,
            action: result.action,
            entityType: result.entityType,
            entityId: result.entityId,
            metadata: result.metadata,
            createdAt: result.createdAt,
        };
    }
    /**
     * Find audit logs with optional filters
     */
    async findAll(filters = {}) {
        const where = {};
        if (filters.entityType) {
            where['entityType'] = filters.entityType;
        }
        if (filters.entityId) {
            where['entityId'] = filters.entityId;
        }
        if (filters.actorId) {
            where['actorId'] = filters.actorId;
        }
        if (filters.startDate || filters.endDate) {
            const createdAt = {};
            if (filters.startDate) {
                createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                createdAt.lte = filters.endDate;
            }
            where['createdAt'] = createdAt;
        }
        const results = await prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return results.map((r) => ({
            id: r.id,
            actorId: r.actorId,
            action: r.action,
            entityType: r.entityType,
            entityId: r.entityId,
            metadata: r.metadata,
            createdAt: r.createdAt,
        }));
    }
    /**
     * Find audit logs by entity
     */
    async findByEntity(entityType, entityId) {
        const results = await prisma.auditLog.findMany({
            where: { entityType, entityId },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        return results.map((r) => ({
            id: r.id,
            actorId: r.actorId,
            action: r.action,
            entityType: r.entityType,
            entityId: r.entityId,
            metadata: r.metadata,
            createdAt: r.createdAt,
        }));
    }
}
// Export singleton instance
export const auditRepository = new AuditRepository();
//# sourceMappingURL=audit.repository.js.map