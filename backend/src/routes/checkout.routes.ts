import { Router } from 'express';
import { cartRepository } from '../repositories/cart.repository.js';
import { codEligibilityService } from '../services/cod-eligibility.service.js';
import { checkoutController } from '../controllers/checkout.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { checkoutSchema, checkoutQuoteSchema } from '../validators/checkout.validation.js';

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

// POST /v1/checkout/quote - Price breakup before placing the order
checkoutRouter.post(
	'/quote',
	validateRequest(checkoutQuoteSchema),
	(req, res, next) => checkoutController.quote(req, res, next)
);

// GET /v1/checkout/cod-eligibility[?variantIds=a,b] - Can this cart (or buy-now
// selection) be paid by Cash on Delivery? { available, reason, blocked }
checkoutRouter.get('/cod-eligibility', async (req, res, next) => {
	try {
		const raw = typeof req.query.variantIds === 'string' ? req.query.variantIds : '';
		const variantIds = raw.split(',').map((v) => v.trim()).filter(Boolean).slice(0, 100);
		const rows = await cartRepository.getCartForCheckout(req.user!.userId);
		const selected = variantIds.length ? rows.filter((r) => variantIds.includes(r.variantId)) : rows;
		res.json(await codEligibilityService.check(req.user!.userId, selected));
	} catch (error) {
		next(error);
	}
});
