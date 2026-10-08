import { addressService } from '../services/address.service.js';
import { createAddressSchema, updateAddressSchema, addressIdParamSchema, } from '../validators/address.validator.js';
/**
 * Address Controller
 * Handles HTTP requests for buyer address management
 */
export class AddressController {
    /**
     * List all addresses for the authenticated user.
     * GET /v1/addresses
     */
    async list(req, res, next) {
        try {
            const userId = req.user.userId;
            const addresses = await addressService.list(userId);
            res.json({ addresses });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Create a new address.
     * POST /v1/addresses
     */
    async create(req, res, next) {
        try {
            const userId = req.user.userId;
            const validated = createAddressSchema.parse(req.body);
            const address = await addressService.create(userId, validated);
            res.status(201).json({ address });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update an existing address.
     * PUT /v1/addresses/:addressId
     */
    async update(req, res, next) {
        try {
            const userId = req.user.userId;
            const { addressId } = addressIdParamSchema.parse(req.params);
            const validated = updateAddressSchema.parse(req.body);
            // Ensure at least one field is being updated
            if (Object.keys(validated).length === 0) {
                res.status(400).json({ message: 'No fields to update' });
                return;
            }
            const address = await addressService.update(userId, addressId, validated);
            res.json({ address });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete an address.
     * DELETE /v1/addresses/:addressId
     */
    async delete(req, res, next) {
        try {
            const userId = req.user.userId;
            const { addressId } = addressIdParamSchema.parse(req.params);
            await addressService.delete(userId, addressId);
            res.status(204).send();
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Set an address as the default.
     * PATCH /v1/addresses/:addressId/default
     */
    async setDefault(req, res, next) {
        try {
            const userId = req.user.userId;
            const { addressId } = addressIdParamSchema.parse(req.params);
            const address = await addressService.setDefault(userId, addressId);
            res.json({ address });
        }
        catch (error) {
            next(error);
        }
    }
}
export const addressController = new AddressController();
//# sourceMappingURL=address.controller.js.map