/**
 * Website content: app/social links, Careers and Investors.
 *
 *   /v1/site        — public (storefront + seller panel)
 *   /v1/admin/site  — admin management ("content" section for employees)
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize, optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { ApiError } from '../errors/ApiError.js';
import { redis } from '../config/redis.js';
import { siteContentService } from '../services/site-content.service.js';

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;
const h = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await fn(req, res);
        if (!res.headersSent) res.json({ success: true, data });
    } catch (err) {
        if (err instanceof z.ZodError) {
            next(ApiError.badRequest(err.issues.map((i) => i.message).join('; ')));
            return;
        }
        next(err);
    }
};
const param = (req: Request, name: string) => String(req.params[name] ?? '');

/** Public forms: at most 5 submissions per IP per 10 minutes. */
function formRateLimit(bucket: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const key = `ratelimit:site-form:${bucket}:${req.ip ?? 'unknown'}`;
            const count = await redis.incr(key);
            if (count === 1) await redis.expire(key, 600);
            if (count > 5) {
                res.setHeader('Retry-After', '600');
                res.status(429).json({ success: false, error: { message: 'Too many submissions. Please try again in a few minutes.' } });
                return;
            }
        } catch {
            // Redis down: let the submission through rather than lose it.
        }
        next();
    };
}

export const sitePublicRouter = Router();
sitePublicRouter.get('/links', h(() => siteContentService.getLinks()));
sitePublicRouter.get('/careers', h(() => siteContentService.publicJobs()));
sitePublicRouter.post(
    '/careers/apply',
    formRateLimit('careers'),
    optionalAuthenticate,
    h((req) => siteContentService.apply(req.body, req.user?.userId ?? null))
);
sitePublicRouter.post('/investors', formRateLimit('investors'), h((req) => siteContentService.createInquiry(req.body)));

export const siteAdminRouter = Router();
siteAdminRouter.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));
siteAdminRouter.get('/links', h(() => siteContentService.getLinks()));
siteAdminRouter.put('/links', h((req) => siteContentService.saveLinks(req.body)));
siteAdminRouter.get('/jobs', h(() => siteContentService.adminJobs()));
siteAdminRouter.post('/jobs', h((req) => siteContentService.createJob(req.body)));
siteAdminRouter.patch('/jobs/:id', h((req) => siteContentService.updateJob(param(req, 'id'), req.body)));
siteAdminRouter.delete('/jobs/:id', h((req) => siteContentService.deleteJob(param(req, 'id'))));
siteAdminRouter.get('/applications', h((req) => siteContentService.applications(req.query)));
siteAdminRouter.patch('/applications/:id', h((req) => siteContentService.setApplicationStatus(param(req, 'id'), req.body)));
siteAdminRouter.get('/investors', h((req) => siteContentService.inquiries(req.query)));
siteAdminRouter.patch('/investors/:id', h((req) => siteContentService.setInquiryStatus(param(req, 'id'), req.body)));
