import type { Request, Response, NextFunction } from 'express';
/**
 * Shiprocket Checkout (Fastrr) — buyer-facing endpoints.
 *
 * Two calls bracket the buyer's trip through the overlay: one to open it, one to
 * find out how it ended. Everything in between happens on Fastrr's side.
 */
export declare class FastrrController {
    /**
     * POST /v1/fastrr/checkout/token
     *
     * Mints the access token the storefront hands to HeadlessCheckout.addToCart.
     */
    createToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v1/fastrr/checkout/sessions/:sessionId
     *
     * Polled by the callback page after Fastrr redirects the buyer back. It does
     * not wait for the webhook: it asks Fastrr directly and places the order on
     * the spot if it is paid, so the buyer sees their order immediately even when
     * the webhook is slow or lost.
     */
    getSessionStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v1/config/checkout — unauthenticated.
     *
     * Tells the storefront which checkout to render. Keeping the decision on the
     * server means the flag flips for every client at once, including app builds
     * already installed on phones.
     */
    getCheckoutConfig(_req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const fastrrController: FastrrController;
//# sourceMappingURL=fastrr.controller.d.ts.map