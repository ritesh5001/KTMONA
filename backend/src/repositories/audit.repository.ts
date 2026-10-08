/**
 * Audit Repository
 * Database operations for audit logs
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

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
export class AuditRepository {
    /**
     * Create a new audit log entry
     */
    async create(data: CreateAuditLogInput): Promise<AuditLogResult> {
        // Build create data - omit metadata if null/undefined
        const createPayload = {
            actorId: data.actorId,
            action: data.action,
            entityType: data.entityType,
            entityId: data.entityId,
            ...(data.metadata != null && { metadata: data.metadata }),
        } as Prisma.AuditLogUncheckedCreateInput;

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
    async findAll(filters: AuditLogFilters = {}): Promise<AuditLogResult[]> {
        const where: Record<string, unknown> = {};

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
            const createdAt: { gte?: Date; lte?: Date } = {};
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
    async findByEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLogResult[]> {
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
