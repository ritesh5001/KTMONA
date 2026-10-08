/**
 * Commission Rule Service
 * CRUD for commission rules with priority: seller > category > global
 */
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
export class CommissionRuleService {
    /**
     * List all commission rules with optional filters
     */
    async listRules(filters = {}) {
        const where = {};
        if (filters.sellerId)
            where.sellerId = filters.sellerId;
        if (filters.categoryId)
            where.categoryId = filters.categoryId;
        if (filters.isActive !== undefined)
            where.isActive = filters.isActive;
        const rules = await prisma.commissionRule.findMany({
            where,
            orderBy: [
                { sellerId: { sort: 'asc', nulls: 'last' } },
                { categoryId: { sort: 'asc', nulls: 'last' } },
                { createdAt: 'desc' },
            ],
            include: {
                seller: { select: { id: true, email: true, seller_profiles: { select: { store_name: true } } } },
                category: { select: { id: true, name: true } },
            },
        });
        return { rules };
    }
    /**
     * Create a new commission rule
     */
    async createRule(input) {
        const sellerId = input.sellerId || null;
        const categoryId = input.categoryId || null;
        // Check for duplicate seller+category combination
        const existing = await prisma.commissionRule.findFirst({
            where: {
                sellerId: sellerId,
                categoryId: categoryId,
            },
        });
        if (existing) {
            throw ApiError.conflict('A commission rule for this seller/category combination already exists');
        }
        const rule = await prisma.commissionRule.create({
            data: {
                sellerId,
                categoryId,
                commissionPercent: input.commissionPercent,
                platformFee: input.platformFee,
                isActive: input.isActive ?? true,
            },
        });
        return rule;
    }
    /**
     * Update a commission rule
     */
    async updateRule(id, input) {
        const rule = await prisma.commissionRule.findUnique({ where: { id } });
        if (!rule)
            throw ApiError.notFound('Commission rule not found');
        // If changing seller/category, check uniqueness
        const newSellerId = input.sellerId !== undefined ? input.sellerId : rule.sellerId;
        const newCategoryId = input.categoryId !== undefined ? input.categoryId : rule.categoryId;
        if (newSellerId !== rule.sellerId || newCategoryId !== rule.categoryId) {
            const existing = await prisma.commissionRule.findFirst({
                where: {
                    sellerId: newSellerId,
                    categoryId: newCategoryId,
                    id: { not: id },
                },
            });
            if (existing) {
                throw ApiError.conflict('A commission rule for this seller/category combination already exists');
            }
        }
        const updated = await prisma.commissionRule.update({
            where: { id },
            data: {
                ...(input.sellerId !== undefined && { sellerId: input.sellerId }),
                ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
                ...(input.commissionPercent !== undefined && { commissionPercent: input.commissionPercent }),
                ...(input.platformFee !== undefined && { platformFee: input.platformFee }),
                ...(input.isActive !== undefined && { isActive: input.isActive }),
            },
        });
        return updated;
    }
    /**
     * Delete a commission rule (guard: cannot delete last active global rule)
     */
    async deleteRule(id) {
        const rule = await prisma.commissionRule.findUnique({ where: { id } });
        if (!rule)
            throw ApiError.notFound('Commission rule not found');
        // Guard: cannot delete the last active global rule
        if (!rule.sellerId && !rule.categoryId && rule.isActive) {
            const globalCount = await prisma.commissionRule.count({
                where: { sellerId: null, categoryId: null, isActive: true },
            });
            if (globalCount <= 1) {
                throw ApiError.badRequest('Cannot delete the last active global commission rule');
            }
        }
        await prisma.commissionRule.delete({ where: { id } });
    }
}
export const commissionRuleService = new CommissionRuleService();
//# sourceMappingURL=commissionRule.service.js.map