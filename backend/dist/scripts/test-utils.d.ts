import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import(".prisma/client").Prisma.RejectOnNotFound | import(".prisma/client").Prisma.RejectPerOperation | undefined, import("@prisma/client/runtime/index.js").DefaultArgs>;
export declare const BASE_URL: string;
export declare const COLORS: {
    green: string;
    red: string;
    cyan: string;
    reset: string;
    gray: string;
};
export declare const LOG: {
    info: (msg: string) => void;
    success: (msg: string) => void;
    error: (msg: string, details?: any) => void;
    step: (msg: string) => void;
};
export declare function request(path: string, method?: string, body?: any, token?: string): Promise<{
    status: number;
    data: any;
}>;
export declare function ensureAdminToken(): Promise<string>;
export declare function ensureSeller(): Promise<{
    email: string;
    password: string;
}>;
export declare function ensureBuyer(): Promise<{
    email: string;
    password: string;
}>;
//# sourceMappingURL=test-utils.d.ts.map