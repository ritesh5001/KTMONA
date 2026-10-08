import { z } from 'zod';
export declare const summaryQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        startDate: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        endDate: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strip", z.ZodTypeAny, {
        startDate?: string | undefined;
        endDate?: string | undefined;
    }, {
        startDate?: string | undefined;
        endDate?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        startDate?: string | undefined;
        endDate?: string | undefined;
    };
}, {
    query: {
        startDate?: string | undefined;
        endDate?: string | undefined;
    };
}>;
export declare const chartQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        interval: z.ZodDefault<z.ZodEnum<["daily", "weekly", "monthly"]>>;
    }, "strip", z.ZodTypeAny, {
        interval: "daily" | "weekly" | "monthly";
    }, {
        interval?: "daily" | "weekly" | "monthly" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        interval: "daily" | "weekly" | "monthly";
    };
}, {
    query: {
        interval?: "daily" | "weekly" | "monthly" | undefined;
    };
}>;
export declare const topProductsQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        limit: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
    }, {
        limit?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
    };
}, {
    query: {
        limit?: number | undefined;
    };
}>;
export declare const refundImpactQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        startDate: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        endDate: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strip", z.ZodTypeAny, {
        startDate?: string | undefined;
        endDate?: string | undefined;
    }, {
        startDate?: string | undefined;
        endDate?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        startDate?: string | undefined;
        endDate?: string | undefined;
    };
}, {
    query: {
        startDate?: string | undefined;
        endDate?: string | undefined;
    };
}>;
//# sourceMappingURL=sellerAnalytics.validation.d.ts.map