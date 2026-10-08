import { Router } from 'express';
import { checkoutController } from '../controllers/checkout.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { checkoutSchema } from '../validators/checkout.validation.js';

/**
 * Checkout Routes
 * All routes require USER role (buyer only)
 */
export const checkoutRouter = Router();

// All checkout routes require authentication and USER role
checkoutRouter.use(authenticate);
checkoutRouter.use(authorize('USER'));

// POST /v1/checkout - Process checkout
checkoutRouter.post(
	'/',
	validateRequest(checkoutSchema),
	(req, res, next) => checkoutController.checkout(req, res, next)
);
