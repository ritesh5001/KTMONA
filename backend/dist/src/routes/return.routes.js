import { Router } from 'express';
import { returnController } from '../controllers/return.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
export const returnRouter = Router();
returnRouter.use(authenticate);
// Admin list endpoint
returnRouter.get('/', authorize('ADMIN'), (req, res, next) => returnController.listReturns(req, res, next));
// Buyer endpoints
returnRouter.post('/:orderId', authorize('USER'), (req, res, next) => returnController.requestReturn(req, res, next));
returnRouter.get('/my', authorize('USER'), (req, res, next) => returnController.getMyReturns(req, res, next));
returnRouter.get('/:id', authorize('USER'), (req, res, next) => returnController.getReturnById(req, res, next));
// Admin endpoints
returnRouter.patch('/:id/approve', authorize('ADMIN'), (req, res, next) => returnController.approveReturn(req, res, next));
returnRouter.patch('/:id/reject', authorize('ADMIN'), (req, res, next) => returnController.rejectReturn(req, res, next));
returnRouter.post('/:id/refund', authorize('ADMIN'), (req, res, next) => returnController.processRefund(req, res, next));
//# sourceMappingURL=return.routes.js.map