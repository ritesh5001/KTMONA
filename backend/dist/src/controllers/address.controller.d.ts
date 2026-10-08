import type { Request, Response, NextFunction } from 'express';
/**
 * Address Controller
 * Handles HTTP requests for buyer address management
 */
export declare class AddressController {
    /**
     * List all addresses for the authenticated user.
     * GET /v1/addresses
     */
    list(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Create a new address.
     * POST /v1/addresses
     */
    create(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update an existing address.
     * PUT /v1/addresses/:addressId
     */
    update(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Delete an address.
     * DELETE /v1/addresses/:addressId
     */
    delete(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Set an address as the default.
     * PATCH /v1/addresses/:addressId/default
     */
    setDefault(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const addressController: AddressController;
//# sourceMappingURL=address.controller.d.ts.map