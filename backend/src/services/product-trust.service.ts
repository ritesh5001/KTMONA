/**
 * Product Q&A (shoppers ask, the seller or an admin answers) and shopper reports
 * of incorrect product information (wrong price, specs, images, counterfeit…).
 */

import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { notificationService } from '../notifications/notification.service.js';

export const PRODUCT_REPORT_TYPES = ['WRONG_PRICE', 'WRONG_SPECS', 'WRONG_IMAGES', 'FAKE_OR_COUNTERFEIT', 'OFFENSIVE', 'OTHER'] as const;

export const askQuestionSchema = z.object({
    question: z.string().trim().min(10, 'Please write at least 10 characters').max(500),
});
export const answerQuestionSchema = z.object({
    answer: z.string().trim().min(2).max(1000),
});
export const productReportSchema = z.object({
    type: z.enum(PRODUCT_REPORT_TYPES),
    details: z.string().trim().max(1000).optional(),
});

/** Questions one customer may ask per day (spam guard). */
const QUESTIONS_PER_DAY = 10;

export const productTrustService = {
    async listQuestions(productId: string) {
        const rows = await prisma.productQuestion.findMany({
            where: { productId, isHidden: false, answeredAt: { not: null } },
            orderBy: { answeredAt: 'desc' },
            take: 50,
        });
        return {
            questions: rows.map((q) => ({
                id: q.id,
                question: q.question,
                answer: q.answer,
                answeredBy: q.answeredBy === 'ADMIN' ? 'KTMONA' : 'Seller',
                answeredAt: q.answeredAt?.toISOString() ?? null,
                createdAt: q.createdAt.toISOString(),
            })),
        };
    },

    async ask(productId: string, userId: string, question: string) {
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, sellerId: true, title: true } });
        if (!product) throw ApiError.notFound('Product not found');
        const today = await prisma.productQuestion.count({
            where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        });
        if (today >= QUESTIONS_PER_DAY) throw new ApiError(429, 'You have asked several questions today. Please try again tomorrow.');
        const created = await prisma.productQuestion.create({ data: { productId, userId, question } });
        void notificationService.create({
            userId: product.sellerId,
            role: 'SELLER',
            type: 'ADMIN_ALERT',
            channel: 'EMAIL',
            content: `New customer question on ${product.title}`,
            metadata: { title: 'New customer question', message: `"${question}" — answer it in Seller Panel → Customer Questions.` },
            eventKey: `PRODUCT_QUESTION:${created.id}`,
        }).catch(() => undefined);
        return { question: { id: created.id, status: 'PENDING' } };
    },

    /** Unanswered (or all) questions on a seller's products. */
    async sellerQuestions(sellerId: string, onlyOpen = true) {
        const products = await prisma.product.findMany({ where: { sellerId }, select: { id: true, title: true } });
        const titles = new Map(products.map((p) => [p.id, p.title]));
        const rows = await prisma.productQuestion.findMany({
            where: { productId: { in: [...titles.keys()] }, isHidden: false, ...(onlyOpen ? { answeredAt: null } : {}) },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        return { questions: rows.map((q) => ({ ...q, productTitle: titles.get(q.productId) ?? '' })) };
    },

    async answer(questionId: string, by: { userId: string; role: string }, answer: string) {
        const q = await prisma.productQuestion.findUnique({ where: { id: questionId } });
        if (!q) throw ApiError.notFound('Question not found');
        const isAdmin = by.role === 'ADMIN' || by.role === 'SUPER_ADMIN';
        if (!isAdmin) {
            const product = await prisma.product.findUnique({ where: { id: q.productId }, select: { sellerId: true } });
            if (product?.sellerId !== by.userId) throw ApiError.forbidden('You can only answer questions on your own products');
        }
        const updated = await prisma.productQuestion.update({
            where: { id: questionId },
            data: { answer, answeredBy: isAdmin ? 'ADMIN' : 'SELLER', answeredAt: new Date() },
        });
        void notificationService.create({
            userId: q.userId,
            role: 'USER',
            type: 'ORDER_UPDATE',
            channel: 'EMAIL',
            content: 'Your product question was answered',
            metadata: { title: 'Your question was answered', message: `Q: ${q.question}\nA: ${answer}`, productId: q.productId },
            eventKey: `QUESTION_ANSWERED:${q.id}`,
        }).catch(() => undefined);
        return { question: updated };
    },

    async adminQuestions() {
        const rows = await prisma.productQuestion.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
        const products = await prisma.product.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.productId))] } }, select: { id: true, title: true } });
        const titles = new Map(products.map((p) => [p.id, p.title]));
        return { questions: rows.map((q) => ({ ...q, productTitle: titles.get(q.productId) ?? '' })) };
    },

    async setQuestionHidden(questionId: string, hidden: boolean) {
        return { question: await prisma.productQuestion.update({ where: { id: questionId }, data: { isHidden: hidden } }) };
    },

    async report(productId: string, userId: string, input: z.infer<typeof productReportSchema>) {
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true } });
        if (!product) throw ApiError.notFound('Product not found');
        const recent = await prisma.productReport.findFirst({
            where: { productId, userId, status: 'OPEN' },
        });
        if (recent) return { reported: true, alreadyReported: true };
        await prisma.productReport.create({ data: { productId, userId, type: input.type, details: input.details ?? null } });
        const open = await prisma.productReport.count({ where: { productId, status: 'OPEN' } });
        if (open === 1 || open % 5 === 0) {
            void notificationService.notifyAdmin(
                'Product information reported',
                `"${product.title}" (${productId}) was reported: ${input.type}${input.details ? ` — ${input.details}` : ''}. ${open} open report(s). Admin → Product Reports.`,
            ).catch(() => undefined);
        }
        return { reported: true, alreadyReported: false };
    },

    async adminReports(status: 'OPEN' | 'RESOLVED' | 'ALL' = 'OPEN') {
        const rows = await prisma.productReport.findMany({
            where: status === 'ALL' ? {} : { status },
            orderBy: { createdAt: 'desc' },
            take: 300,
        });
        const products = await prisma.product.findMany({
            where: { id: { in: [...new Set(rows.map((r) => r.productId))] } },
            select: { id: true, title: true, sellerId: true },
        });
        const byId = new Map(products.map((p) => [p.id, p]));
        return { reports: rows.map((r) => ({ ...r, productTitle: byId.get(r.productId)?.title ?? '' })) };
    },

    async resolveReport(reportId: string) {
        return { report: await prisma.productReport.update({ where: { id: reportId }, data: { status: 'RESOLVED', resolvedAt: new Date() } }) };
    },
};
