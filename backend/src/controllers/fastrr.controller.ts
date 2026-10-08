import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { fastrrCheckoutService } from '../services/fastrr-checkout.service.js';
import { fastrrOrderService } from '../services/fastrr-order.service.js';
import { isFastrrCheckoutEnabled } from '../services/fastrr.client.js';

/**
 * Shiprocket Checkout (Fastrr) — buyer-facing endpoints.
 *
 * Two calls bracket the buyer's trip through the overlay: one to open it, one to
 * find out how it ended. Everything in between happens on Fastrr's side.
 */
export class FastrrController {
    /**
     * POST /v1/fastrr/checkout/token
     *
     * Mints the access token the storefront hands to HeadlessCheckout.addToCart.
     */
    async createToken(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const { couponCode, variantIds, mobileApp } = req.body ?? {};

            const session = await fastrrCheckoutService.createSession({
                userId,
                variantIds: Array.isArray(variantIds) ? variantIds : undefined,
                couponCode: typeof couponCode === 'string' ? couponCode : undefined,
                mobileApp: mobileApp === true || mobileApp === 'true',
            });

            res.status(201).json(session);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /v1/fastrr/checkout/sessions/:sessionId
     *
     * Polled by the callback page after Fastrr redirects the buyer back. It does
     * not wait for the webhook: it asks Fastrr directly and places the order on
     * the spot if it is paid, so the buyer sees their order immediately even when
     * the webhook is slow or lost.
     */
    async getSessionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const raw = req.params['sessionId'];
            const sessionId = Array.isArray(raw) ? raw[0] : raw;
            if (!sessionId) throw ApiError.badRequest('Session id is required');

            const session = await prisma.fastrrCheckoutSession.findUnique({
                where: { id: sessionId },
                select: { id: true, userId: true, fastrrOrderId: true, orderId: true, status: true },
            });

            // Not found and not-yours are answered identically: distinguishing them
            // would let anyone probe which session ids exist.
            if (!session || session.userId !== userId) {
                throw ApiError.notFound('Checkout session not found');
            }

            if (session.orderId) {
                res.json({
                    status: 'COMPLETED',
                    orderId: session.orderId,
                    message: 'Order placed',
                });
                return;
            }

            const result = await fastrrOrderService.syncFromFastrr(
                session.fastrrOrderId,
                'callback',
            );

            res.json({
                status: result.status,
                orderId: result.orderId,
                message: result.message,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /v1/config/checkout — unauthenticated.
     *
     * Tells the storefront which checkout to render. Keeping the decision on the
     * server means the flag flips for every client at once, including app builds
     * already installed on phones.
     */
    async getCheckoutConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            res.json({ provider: isFastrrCheckoutEnabled() ? 'FASTRR' : 'NATIVE' });
        } catch (error) {
            next(error);
        }
    }
}

export const fastrrController = new FastrrController();
