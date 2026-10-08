import { prisma } from '../config/db.js';
export class OtpRepository {
    async createOtp(data) {
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
    async findLatestValid(email, purpose) {
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
    async findLatestByEmail(email, purpose) {
        return prisma.emailOtp.findFirst({
            where: {
                email,
                purpose,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async markUsed(id) {
        return prisma.emailOtp.update({
            where: { id },
            data: { usedAt: new Date() },
        });
    }
}
export const otpRepository = new OtpRepository();
//# sourceMappingURL=otp.repository.js.map