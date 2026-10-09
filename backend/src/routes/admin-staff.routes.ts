/**
 * Admin staff: employee accounts with limited sections, the activity log, and
 * the signed-in admin's own access.
 *
 *   /v1/admin/me         — any admin account (drives the sidebar)
 *   /v1/admin/employees  — full admins only (unmapped path ⇒ employees refused)
 *   /v1/admin/activity   — admins, and employees given the "activity" section
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { ApiError } from '../errors/ApiError.js';
import { createEmployeeSchema, staffService, updateEmployeeSchema } from '../services/admin-center/staff.service.js';

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

export const adminMeRouter = Router();
adminMeRouter.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));
adminMeRouter.get('/access', h((req) => staffService.myAccess(req.user!.userId)));

export const adminEmployeesRouter = Router();
adminEmployeesRouter.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));
adminEmployeesRouter.get('/', h(() => staffService.list()));
adminEmployeesRouter.get('/permissions', h(() => ({ permissions: staffService.permissions() })));
adminEmployeesRouter.post('/', h((req) => staffService.create(createEmployeeSchema.parse(req.body))));
adminEmployeesRouter.patch('/:id', h((req) => staffService.update(param(req, 'id'), updateEmployeeSchema.parse(req.body))));

export const adminActivityRouter = Router();
adminActivityRouter.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));
adminActivityRouter.get('/', h((req) => staffService.activity(req.query)));
adminActivityRouter.get('/actors', h(() => staffService.activityActors()));
