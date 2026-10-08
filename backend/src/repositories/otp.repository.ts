import { prisma } from '../config/db.js';
import { OtpPurpose } from '@prisma/client';

export class OtpRepository {
    async createOtp(data: {
        userId?: string | null;
        email: string;
        codeHash: string;
        purpose: OtpPurpose;
        expiresAt: Date;
        payload?: Record<string, any> | null;
    }) {
        return prisma.emailOtp.create({
            data: {
                email: data.email,
                codeHash: data.codeHash,
                purpose: data.purpose,
                expiresAt: data.expiresAt,
                ...(data.userId ? { userId: data.userId } : {}),
                ...(data.payload ? { payload: data.payload } : {}),
            },
        });
    }

    async findLatestValid(email: string, purpose: OtpPurpose) {
        return prisma.emailOtp.findFirst({
            where: {
                email,
                purpose,
                usedAt: null,
                expiresAt: {
                    gt: new Date(),
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findLatestByEmail(email: string, purpose: OtpPurpose) {
        return prisma.emailOtp.findFirst({
            where: {
                email,
                purpose,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async markUsed(id: string) {
        return prisma.emailOtp.update({
            where: { id },
            data: { usedAt: new Date() },
        });
    }
}

export const otpRepository = new OtpRepository();
