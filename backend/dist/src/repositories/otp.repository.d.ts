import { OtpPurpose } from '@prisma/client';
export declare class OtpRepository {
    createOtp(data: {
        userId?: string | null;
        email: string;
        codeHash: string;
        purpose: OtpPurpose;
        expiresAt: Date;
        payload?: Record<string, any> | null;
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        email: string;
        codeHash: string;
        purpose: OtpPurpose;
        expiresAt: Date;
        usedAt: Date | null;
        createdAt: Date;
        payload: import(".prisma/client").Prisma.JsonValue | null;
    }, unknown> & {}>;
    findLatestValid(email: string, purpose: OtpPurpose): Promise<(import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        email: string;
        codeHash: string;
        purpose: OtpPurpose;
        expiresAt: Date;
        usedAt: Date | null;
        createdAt: Date;
        payload: import(".prisma/client").Prisma.JsonValue | null;
    }, unknown> & {}) | null>;
    findLatestByEmail(email: string, purpose: OtpPurpose): Promise<(import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        email: string;
        codeHash: string;
        purpose: OtpPurpose;
        expiresAt: Date;
        usedAt: Date | null;
        createdAt: Date;
        payload: import(".prisma/client").Prisma.JsonValue | null;
    }, unknown> & {}) | null>;
    markUsed(id: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        email: string;
        codeHash: string;
        purpose: OtpPurpose;
        expiresAt: Date;
        usedAt: Date | null;
        createdAt: Date;
        payload: import(".prisma/client").Prisma.JsonValue | null;
    }, unknown> & {}>;
}
export declare const otpRepository: OtpRepository;
//# sourceMappingURL=otp.repository.d.ts.map