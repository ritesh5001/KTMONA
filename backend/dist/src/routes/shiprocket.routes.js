import { Router } from 'express';
import { shiprocketCatalogController } from '../controllers/shiprocket-catalog.controller.js';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
/**
 * Shiprocket Catalog Routes
 * Base path: /v1/shiprocket
 *
 * Read-only endpoints Shiprocket Checkout (Fastrr) polls to sync the catalog.
 * They expose the full inventory and pricing, so they are shielded by a shared
 * secret when one is configured.
 */
const shiprocketRouter = Router();
/**
 * Shared-secret gate.
 *
 * Shiprocket's documented cURL examples send no auth header, so requiring one
 * unconditionally would break the integration on day one. Instead the guard
 * activates only once SHIPROCKET_API_KEY is set: leave it unset to launch, then
 * set it on both sides to close the endpoint. Accepts either a bearer token or
 * an x-api-key header, since which one Shiprocket can send is still open.
 */
function authorizeCatalogRequest(req, _res, next) {
    const expected = env.SHIPROCKET_API_KEY?.trim();
    if (!expected) {
        next();
        return;
    }
    const header = req.header('x-api-key')?.trim();
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const provided = header || bearer;
    if (provided !== expected) {
        next(ApiError.unauthorized('Invalid or missing catalog API key'));
        return;
    }
    next();
}
shiprocketRouter.use(authorizeCatalogRequest);
/**
 * GET /v1/shiprocket/products?page=1&limit=100
 * GET /v1/shiprocket/products?collection_id=123&page=1&limit=100
 */
shiprocketRouter.get('/products', shiprocketCatalogController.listProducts);
/** GET /v1/shiprocket/collections?page=1&limit=100 */
shiprocketRouter.get('/collections', shiprocketCatalogController.listCollections);
export { shiprocketRouter };
//# sourceMappingURL=shiprocket.routes.js.map