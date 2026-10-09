/**
 * Website content the admin manages outside the catalog:
 *  - app download + social media links (Follow Us, Download App pop-up)
 *  - Careers: job openings and the applications sent for them
 *  - Investors: enquiries sent from the Investors page
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { parseLimit, parsePage } from './seller-center/common.js';

const LINKS_KEY = 'site.links';

const optionalUrl = z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Links must start with http:// or https://')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const siteLinksSchema = z.object({
    playStoreUrl: optionalUrl,
    appStoreUrl: optionalUrl,
    facebookUrl: optionalUrl,
    instagramUrl: optionalUrl,
    youtubeUrl: optionalUrl,
});

export type SiteLinks = {
    playStoreUrl: string | null;
    appStoreUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    youtubeUrl: string | null;
};

/** The client's official pages; the app is not published yet, YouTube has no channel yet. */
const DEFAULT_LINKS: SiteLinks = {
    playStoreUrl: null,
    appStoreUrl: null,
    facebookUrl: 'https://www.facebook.com/share/1F8jbWMxN8/',
    instagramUrl: 'https://www.instagram.com/ktmona',
    youtubeUrl: null,
};

export const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT'] as const;

export const jobSchema = z.object({
    title: z.string().trim().min(2, 'Job title is required').max(120),
    department: z.string().trim().max(80).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    type: z.enum(JOB_TYPES).default('FULL_TIME'),
    description: z.string().trim().min(10, 'Describe the role in a few lines').max(8000),
    isActive: z.boolean().default(true),
});

export const applicationSchema = z.object({
    jobId: z.string().trim().max(60).nullable().optional(),
    name: z.string().trim().min(2, 'Enter your name').max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    phone: z.string().trim().regex(/^[+\d][\d\s-]{8,16}$/, 'Enter a valid phone number').nullable().optional(),
    resumeUrl: z
        .string()
        .trim()
        .max(1000)
        .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Resume link must start with http:// or https://')
        .nullable()
        .optional(),
    message: z.string().trim().max(3000).nullable().optional(),
    source: z.enum(['customer', 'seller']).default('customer'),
});

export const investorInquirySchema = z.object({
    name: z.string().trim().min(2, 'Enter your name').max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    phone: z.string().trim().regex(/^[+\d][\d\s-]{8,16}$/, 'Enter a valid phone number').nullable().optional(),
    organization: z.string().trim().max(160).nullable().optional(),
    message: z.string().trim().min(10, 'Tell us a little about your interest').max(4000),
});

export const APPLICATION_STATUSES = ['NEW', 'REVIEWED', 'SHORTLISTED', 'REJECTED', 'HIRED'] as const;
export const INQUIRY_STATUSES = ['NEW', 'CONTACTED', 'CLOSED'] as const;

const nullIfEmpty = (v: string | null | undefined) => (v ? v : null);

export const siteContentService = {
    async getLinks(): Promise<SiteLinks> {
        const row = await prisma.appSetting.findUnique({ where: { key: LINKS_KEY } });
        if (!row) return DEFAULT_LINKS;
        try {
            const saved = JSON.parse(row.value) as Partial<SiteLinks>;
            return { ...DEFAULT_LINKS, ...saved };
        } catch {
            return DEFAULT_LINKS;
        }
    },

    async saveLinks(input: unknown): Promise<SiteLinks> {
        const parsed = siteLinksSchema.parse(input);
        const current = await this.getLinks();
        const next: SiteLinks = {
            playStoreUrl: parsed.playStoreUrl !== undefined ? parsed.playStoreUrl : current.playStoreUrl,
            appStoreUrl: parsed.appStoreUrl !== undefined ? parsed.appStoreUrl : current.appStoreUrl,
            facebookUrl: parsed.facebookUrl !== undefined ? parsed.facebookUrl : current.facebookUrl,
            instagramUrl: parsed.instagramUrl !== undefined ? parsed.instagramUrl : current.instagramUrl,
            youtubeUrl: parsed.youtubeUrl !== undefined ? parsed.youtubeUrl : current.youtubeUrl,
        };
        const value = JSON.stringify(next);
        await prisma.appSetting.upsert({ where: { key: LINKS_KEY }, create: { key: LINKS_KEY, value }, update: { value } });
        return next;
    },

    // ── Careers ────────────────────────────────────────────────────────────
    async publicJobs() {
        const jobs = await prisma.jobOpening.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, department: true, location: true, type: true, description: true, createdAt: true },
        });
        return { jobs };
    },

    async adminJobs() {
        const jobs = await prisma.jobOpening.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { applications: true } } },
        });
        return {
            jobs: jobs.map(({ _count, ...job }) => ({ ...job, applications: _count.applications })),
        };
    },

    async createJob(input: unknown) {
        const data = jobSchema.parse(input);
        return prisma.jobOpening.create({
            data: { ...data, department: nullIfEmpty(data.department), location: nullIfEmpty(data.location) },
        });
    },

    async updateJob(id: string, input: unknown) {
        const data = jobSchema.partial().parse(input);
        const exists = await prisma.jobOpening.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw ApiError.notFound('Job opening not found');
        return prisma.jobOpening.update({
            where: { id },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.department !== undefined ? { department: nullIfEmpty(data.department) } : {}),
                ...(data.location !== undefined ? { location: nullIfEmpty(data.location) } : {}),
                ...(data.type !== undefined ? { type: data.type } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
        });
    },

    async deleteJob(id: string) {
        await prisma.jobOpening.delete({ where: { id } }).catch(() => {
            throw ApiError.notFound('Job opening not found');
        });
        return { deleted: true };
    },

    async apply(input: unknown, userId: string | null) {
        const data = applicationSchema.parse(input);
        if (data.jobId) {
            const job = await prisma.jobOpening.findFirst({ where: { id: data.jobId, isActive: true }, select: { id: true } });
            if (!job) throw ApiError.badRequest('This opening is no longer accepting applications');
        }
        await prisma.jobApplication.create({
            data: {
                jobId: data.jobId || null,
                name: data.name,
                email: data.email,
                phone: nullIfEmpty(data.phone),
                resumeUrl: nullIfEmpty(data.resumeUrl),
                message: nullIfEmpty(data.message),
                source: data.source,
                userId,
            },
        });
        return { message: 'Thanks! Your application has been received. Our team will get in touch if there is a fit.' };
    },

    async applications(query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 25, 100);
        const status = typeof query.status === 'string' && query.status ? query.status : undefined;
        const jobId = typeof query.jobId === 'string' && query.jobId ? query.jobId : undefined;
        const where: Prisma.JobApplicationWhereInput = { ...(status ? { status } : {}), ...(jobId ? { jobId } : {}) };
        const [total, rows] = await Promise.all([
            prisma.jobApplication.count({ where }),
            prisma.jobApplication.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: { job: { select: { id: true, title: true } } },
            }),
        ]);
        return { applications: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    },

    async setApplicationStatus(id: string, input: unknown) {
        const { status } = z.object({ status: z.enum(APPLICATION_STATUSES) }).parse(input);
        return prisma.jobApplication.update({ where: { id }, data: { status } }).catch(() => {
            throw ApiError.notFound('Application not found');
        });
    },

    // ── Investors ──────────────────────────────────────────────────────────
    async createInquiry(input: unknown) {
        const data = investorInquirySchema.parse(input);
        await prisma.investorInquiry.create({
            data: {
                name: data.name,
                email: data.email,
                phone: nullIfEmpty(data.phone),
                organization: nullIfEmpty(data.organization),
                message: data.message,
            },
        });
        return { message: 'Thank you for your interest in KTMONA. Our team will reach out to you shortly.' };
    },

    async inquiries(query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 25, 100);
        const status = typeof query.status === 'string' && query.status ? query.status : undefined;
        const where: Prisma.InvestorInquiryWhereInput = status ? { status } : {};
        const [total, rows] = await Promise.all([
            prisma.investorInquiry.count({ where }),
            prisma.investorInquiry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        ]);
        return { inquiries: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    },

    async setInquiryStatus(id: string, input: unknown) {
        const { status } = z.object({ status: z.enum(INQUIRY_STATUSES) }).parse(input);
        return prisma.investorInquiry.update({ where: { id }, data: { status } }).catch(() => {
            throw ApiError.notFound('Enquiry not found');
        });
    },
};
