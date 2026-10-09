/**
 * Seller Center (Meesho-style supplier panel)
 * Base path: /v1/seller/center — SELLER role only.
 *
 * Also exports the public ads router (/v1/ads) and the admin claims router
 * (/v1/admin/seller-claims).
 */
import { type NextFunction, type Request, type Response } from 'express';
/** 404s every ads endpoint while KTMONA Ads is switched off (FEATURE_ADS). */
export declare function adsEnabledGuard(_req: Request, _res: Response, next: NextFunction): void;
export declare const sellerCenterRouter: import("express-serve-static-core").Router;
export declare const adsRouter: import("express-serve-static-core").Router;
export declare const adminSellerClaimsRouter: import("express-serve-static-core").Router;
//# sourceMappingURL=seller-center.routes.d.ts.map