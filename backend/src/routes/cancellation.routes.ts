import { Router } from 'express';
import { cancellationController } from '../controllers/cancellation.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

export const cancellationRouter = Router();

cancellationRouter.use(authenticate);

// Admin list endpoint
cancellationRouter.get('/', authorize('ADMIN'), (req, res, next) =>
    cancellationController.listCancellations(req, res, next),
);

// Buyer endpoints
cancellationRouter.post('/:orderId', authorize('USER'), (req, res, next) =>
    cancellationController.requestCancellation(req, res, next),
);
cancellationRouter.get('/my', authorize('USER'), (req, res, next) =>
    cancellationController.getMyCancellations(req, res, next),
);

// Admin endpoints
cancellationRouter.patch('/:id/approve', authorize('ADMIN'), (req, res, next) =>
    cancellationController.approveCancellation(req, res, next),
);
cancellationRouter.patch('/:id/reject', authorize('ADMIN'), (req, res, next) =>
    cancellationController.rejectCancellation(req, res, next),
);

// Seller endpoint
cancellationRouter.patch('/:id/seller-approve', authorize('SELLER'), (req, res, next) =>
    cancellationController.sellerApproveCancellation(req, res, next),
);
