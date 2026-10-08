import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
export const appointmentRouter = Router();
appointmentRouter.use(authenticate);
appointmentRouter.post('/create', authorize('USER'), (req, res, next) => appointmentController.create(req, res, next));
appointmentRouter.get('/user', authorize('USER'), (req, res, next) => appointmentController.listUser(req, res, next));
appointmentRouter.get('/seller', authorize('SELLER'), (req, res, next) => appointmentController.listSeller(req, res, next));
appointmentRouter.get('/admin', authorize('ADMIN', 'SUPER_ADMIN'), (req, res, next) => appointmentController.listAdmin(req, res, next));
appointmentRouter.patch('/status', authorize('USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'), (req, res, next) => appointmentController.updateStatus(req, res, next));
appointmentRouter.patch('/admin/reschedule', authorize('ADMIN', 'SUPER_ADMIN'), (req, res, next) => appointmentController.reschedule(req, res, next));
appointmentRouter.patch('/admin/block-seller', authorize('ADMIN', 'SUPER_ADMIN'), (req, res, next) => appointmentController.blockSeller(req, res, next));
//# sourceMappingURL=appointment.routes.js.map