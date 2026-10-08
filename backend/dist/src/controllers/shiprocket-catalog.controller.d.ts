import type { Request, Response, NextFunction } from 'express';
export declare class ShiprocketCatalogController {
    /**
     * GET /v1/shiprocket/products
     * GET /v1/shiprocket/products?collection_id=123
     *
     * One handler for both of Shiprocket's product endpoints — their own example
     * uses the same path, with the collection filter as a query parameter.
     */
    listProducts: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /** GET /v1/shiprocket/collections */
    listCollections: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const shiprocketCatalogController: ShiprocketCatalogController;
//# sourceMappingURL=shiprocket-catalog.controller.d.ts.map