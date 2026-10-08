/**
 * Commission Rule Service
 * CRUD for commission rules with priority: seller > category > global
 */
import type { CreateCommissionRuleInput, UpdateCommissionRuleInput } from '../validators/commissionRule.validation.js';
export declare class CommissionRuleService {
    /**
     * List all commission rules with optional filters
     */
    listRules(filters?: {
        sellerId?: string;
        categoryId?: string;
        isActive?: boolean;
    }): Promise<{
        rules: ({
            seller: {
                id: string;
                email: string | null;
                seller_profiles: {
                    store_name: string;
                } | null;
            } | null;
            category: {
                id: string;
                name: string;
            } | null;
        } & import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string | null;
            categoryId: string | null;
            commissionPercent: import("@prisma/client/runtime/index.js").Decimal;
            platformFee: import("@prisma/client/runtime/index.js").Decimal;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {})[];
    }>;
    /**
     * Create a new commission rule
     */
    createRule(input: CreateCommissionRuleInput): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        sellerId: string | null;
        categoryId: string | null;
        commissionPercent: import("@prisma/client/runtime/index.js").Decimal;
        platformFee: import("@prisma/client/runtime/index.js").Decimal;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    /**
     * Update a commission rule
     */
    updateRule(id: string, input: UpdateCommissionRuleInput): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        sellerId: string | null;
        categoryId: string | null;
        commissionPercent: import("@prisma/client/runtime/index.js").Decimal;
        platformFee: import("@prisma/client/runtime/index.js").Decimal;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    /**
     * Delete a commission rule (guard: cannot delete last active global rule)
     */
    deleteRule(id: string): Promise<void>;
}
export declare const commissionRuleService: CommissionRuleService;
//# sourceMappingURL=commissionRule.service.d.ts.map