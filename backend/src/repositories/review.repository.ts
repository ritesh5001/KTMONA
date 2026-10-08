import { prisma } from '../config/db.js';

export class ReviewRepository {
    async findAll(params?: { skip?: number; take?: number }) {
        const pagination = {
            ...(params?.skip !== undefined ? { skip: params.skip } : {}),
            take: params?.take ?? 100,
        };

        return prisma.review.findMany({
            orderBy: { createdAt: 'desc' },
            ...pagination,
            include: {
                product: { select: { id: true, title: true } },
                user: {
                    select: {
                        id: true,
                        email: true,
                        user_profiles: { select: { full_name: true, avatar: true } },
                    },
                },
            },
        });
    }

    async deleteById(id: string) {
        return prisma.review.update({
            where: { id },
            data: { isHidden: true },
        });
    }
}

export const reviewRepository = new ReviewRepository();
