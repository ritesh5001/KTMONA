/**
 * Minting a Shiprocket Checkout (Fastrr) session.
 *
 * This is the first half of the Fastrr flow. It validates the buyer's selection
 * exactly as the native checkout would, asks Fastrr for an access token, and
 * records a FastrrCheckoutSession so their webhook has something to land on.
 *
 * What it deliberately does *not* do is touch inventory. Fastrr owns the buyer
 * for the next few minutes and most sessions are abandoned; reserving stock here
 * would hold real units hostage to every window that was opened and closed. The
 * order — and the reservation — is created when Fastrr confirms payment, in
 * fastrr-order.service.ts. The cost of that choice is a genuine oversell window
 * on the last unit in stock, which is why `validateSelection` re-checks stock at
 * mint time and the order materialiser fails loudly rather than going negative.
 *
 * Pricing: every line is sent with `catalog_data`, so our price is authoritative
 * even if the catalog feed has not reached Fastrr yet. A *Tatvivah* coupon the
 * buyer applied before launching the overlay is passed as a fixed `cart_discount`
 * — which, per Fastrr's contract, disables their own coupon engine for that
 * session. With no local coupon we send no discount at all and the buyer can use
 * Fastrr's coupons (including the TESTA test code) inside the overlay.
 */
import { randomBytes } from 'node:crypto';
import { Prisma, FastrrSessionStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { cartRepository } from '../repositories/cart.repository.js';
import { ApiError } from '../errors/ApiError.js';
import { checkoutLogger } from '../config/logger.js';
import { couponService } from './coupon.service.js';
import { env } from '../config/env.js';
import { createFastrrAccessToken, getFastrrUiAssets, isFastrrCheckoutEnabled, } from './fastrr.client.js';
/** Mirrors the native checkout's per-checkout cap. */
const MAX_CHECKOUT_ITEMS = 20;
const round2 = (value) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export class FastrrCheckoutService {
    /**
     * Validate the selection, mint a Fastrr token, and persist the session.
     */
    async createSession(request) {
        if (!isFastrrCheckoutEnabled()) {
            throw new ApiError(503, 'Express checkout is currently unavailable');
        }
        const { cartId, lines } = await this.validateSelection(request.userId, request.variantIds);
        const subtotal = lines.reduce((sum, line) => sum.add(new Prisma.Decimal(line.price).mul(line.quantity)), new Prisma.Decimal(0));
        // Quote the coupon only. Redemption happens when the order is created —
        // a buyer who abandons the overlay must not burn a single-use code.
        let discount = new Prisma.Decimal(0);
        let couponCode = null;
        if (request.couponCode?.trim()) {
            const quote = await couponService.applyCouponToOrder({
                userId: request.userId,
                couponCode: request.couponCode,
                orderSubtotal: subtotal,
                sellerIds: Array.from(new Set(lines.map((line) => line.sellerId))),
            });
            discount = round2(quote.discountAmount);
            couponCode = quote.couponCode;
        }
        const items = lines.map((line) => ({
            // Fastrr keys the catalog on the numeric surrogate the sync feed
            // publishes, never our CUID.
            variant_id: line.externalId.toString(),
            quantity: line.quantity,
            catalog_data: {
                price: line.price,
                name: line.name,
                image_url: line.imageUrl,
            },
        }));
        // The session id is minted up front so it can travel in the redirect URL,
        // giving the callback page something to poll before Fastrr's webhook has
        // necessarily arrived.
        const sessionId = newSessionId();
        const redirectUrl = this.buildRedirectUrl(sessionId, request.mobileApp === true);
        const result = await createFastrrAccessToken({
            cart_data: {
                items,
                ...(couponCode && discount.gt(0)
                    ? {
                        cart_discount: {
                            coupon_code: couponCode,
                            amount: Number(discount.toString()),
                        },
                    }
                    : {}),
                custom_attributes: {
                    // Echoed back in some Fastrr payloads; useful for support even
                    // when it is not. Never relied on for correctness — the
                    // session lookup is by their order id.
                    tatvivah_session_id: sessionId,
                },
                mobile_app: request.mobileApp === true,
            },
            redirect_url: redirectUrl,
        });
        const fastrrOrderId = result.data?.order_id;
        if (!fastrrOrderId) {
            throw new ApiError(502, 'Fastrr did not return an order id');
        }
        await prisma.fastrrCheckoutSession.create({
            data: {
                id: sessionId,
                fastrrOrderId,
                userId: request.userId,
                cartId,
                items: lines.map((line) => ({
                    variantId: line.variantId,
                    externalId: line.externalId.toString(),
                    productId: line.productId,
                    sellerId: line.sellerId,
                    quantity: line.quantity,
                    price: line.price,
                })),
                couponCode,
                discountAmount: discount,
                mobileApp: request.mobileApp === true,
                status: FastrrSessionStatus.INITIATED,
                expiresAt: result.expires_at ? new Date(result.expires_at) : null,
            },
        });
        checkoutLogger.info({
            event: 'fastrr_session_created',
            userId: request.userId,
            sessionId,
            fastrrOrderId,
            items: lines.length,
            subtotal: subtotal.toString(),
            couponCode,
        }, `Fastrr checkout session ${sessionId} created`);
        const assets = getFastrrUiAssets();
        return {
            token: result.token,
            expiresAt: result.expires_at,
            fastrrOrderId,
            sessionId,
            scriptUrl: assets.scriptUrl,
            styleUrl: assets.styleUrl,
            redirectUrl,
            fallbackUrl: `${this.frontendBaseUrl()}/checkout?express=off`,
        };
    }
    /**
     * The same checks the native checkout runs before reserving stock. Kept
     * separate from a reservation so an abandoned overlay costs nothing, at the
     * price of a stock re-check being advisory rather than binding.
     */
    async validateSelection(userId, variantIds) {
        const cartRows = await cartRepository.getCartForCheckout(userId);
        if (cartRows.length === 0) {
            throw ApiError.badRequest('Cart is empty');
        }
        const cartId = cartRows[0].cartId;
        const selected = variantIds?.length
            ? cartRows.filter((row) => variantIds.includes(row.variantId))
            : cartRows;
        if (selected.length === 0) {
            throw ApiError.badRequest('The selected item is no longer in your cart');
        }
        if (selected.length > MAX_CHECKOUT_ITEMS) {
            throw ApiError.badRequest(`Cart cannot contain more than ${MAX_CHECKOUT_ITEMS} items per checkout`);
        }
        const errors = [];
        for (const row of selected) {
            const title = row.productTitle ?? 'this item';
            if (row.sellerId == null || row.variantStatus == null || row.variantPrice == null) {
                errors.push(`Product or variant not found for item ${row.itemId}`);
            }
            else if (row.productDeleted || row.productStatus !== 'APPROVED') {
                errors.push(`${title} is no longer available for purchase`);
            }
            else if (row.variantStatus !== 'APPROVED') {
                errors.push(`Selected variant is pending approval for ${title}`);
            }
            else if (row.quantity > row.stock) {
                errors.push(`Insufficient stock for ${title}: Available ${row.stock}, Requested ${row.quantity}`);
            }
        }
        if (errors.length > 0) {
            throw ApiError.badRequest(errors.join('; '));
        }
        // Fastrr needs the numeric surrogate plus a name and image for each line;
        // the cart join carries neither, so one extra read covers all of them.
        const variants = await prisma.productVariant.findMany({
            where: { id: { in: selected.map((row) => row.variantId) } },
            select: {
                id: true,
                externalId: true,
                images: true,
                size: true,
                color: true,
                product: { select: { title: true, images: true } },
            },
        });
        const byId = new Map(variants.map((variant) => [variant.id, variant]));
        const lines = selected.map((row) => {
            const variant = byId.get(row.variantId);
            // Without the surrogate Fastrr has no way to identify the line, and a
            // fabricated id would silently bill the buyer for someone else's
            // product. Refuse rather than guess.
            if (!variant?.externalId) {
                throw new ApiError(409, `${row.productTitle ?? 'An item'} is not available for express checkout yet. Please use standard checkout.`);
            }
            const descriptor = [variant.color?.trim(), variant.size?.trim()]
                .filter(Boolean)
                .join(' / ');
            return {
                variantId: row.variantId,
                externalId: variant.externalId,
                productId: row.productId,
                sellerId: row.sellerId,
                quantity: row.quantity,
                price: Number(row.variantPrice),
                name: descriptor
                    ? `${variant.product.title} (${descriptor})`
                    : variant.product.title,
                imageUrl: variant.images?.[0] ?? variant.product.images?.[0] ?? '',
            };
        });
        return { cartId, lines };
    }
    /**
     * Where Fastrr returns the buyer. It appends `?oid=<order id>&ost=<status>`,
     * so anything we add has to survive alongside those.
     *
     * The same path serves web and app: the Expo WebView recognises the buyer is
     * done by matching this prefix, so it must not diverge from the web route.
     */
    buildRedirectUrl(sessionId, mobileApp) {
        const base = this.frontendBaseUrl();
        const params = new URLSearchParams({ sid: sessionId });
        if (mobileApp)
            params.set('app', '1');
        return `${base}/checkout/fastrr/callback?${params.toString()}`;
    }
    /**
     * Fastrr redirects the buyer's own browser here after taking their money, so
     * a host only a developer can reach is the worst possible value: the charge
     * succeeds and the buyer lands on a dead page. Same reasoning as the PhonePe
     * redirect base in payment.service.ts.
     */
    frontendBaseUrl() {
        const base = env.FRONTEND_BASE_URL?.trim().replace(/\/+$/, '');
        if (!base) {
            throw new ApiError(500, 'FRONTEND_BASE_URL must be set to use express checkout');
        }
        return base;
    }
}
/**
 * Session id. It travels in a URL the buyer can see and edit, so it is generated
 * from a CSPRNG rather than Math.random — guessing one would expose another
 * buyer's checkout status.
 */
function newSessionId() {
    return `frx${randomBytes(16).toString('hex')}`;
}
export const fastrrCheckoutService = new FastrrCheckoutService();
//# sourceMappingURL=fastrr-checkout.service.js.map