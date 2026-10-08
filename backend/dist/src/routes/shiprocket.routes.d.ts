/**
 * Shiprocket Catalog Routes
 * Base path: /v1/shiprocket
 *
 * Read-only endpoints Shiprocket Checkout (Fastrr) polls to sync the catalog.
 * They expose the full inventory and pricing, so they are shielded by a shared
 * secret when one is configured.
 */
declare const shiprocketRouter: import("express-serve-static-core").Router;
export { shiprocketRouter };
//# sourceMappingURL=shiprocket.routes.d.ts.map