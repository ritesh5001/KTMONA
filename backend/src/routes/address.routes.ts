import { Router } from 'express';
import { addressController } from '../controllers/address.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

/**
 * Address Routes
 * All routes require USER role (buyer only)
 */
export const addressRouter = Router();

// All address routes require authentication and USER role
addressRouter.use(authenticate);
addressRouter.use(authorize('USER'));

// GET    /v1/addresses                      – list user addresses
addressRouter.get('/', (req, res, next) => addressController.list(req, res, next));

// POST   /v1/addresses                      – create address
addressRouter.post('/', (req, res, next) => addressController.create(req, res, next));

// PUT    /v1/addresses/:addressId            – update address
addressRouter.put('/:addressId', (req, res, next) => addressController.update(req, res, next));

// DELETE /v1/addresses/:addressId            – delete address
addressRouter.delete('/:addressId', (req, res, next) => addressController.delete(req, res, next));

// PATCH  /v1/addresses/:addressId/default    – set as default
addressRouter.patch('/:addressId/default', (req, res, next) => addressController.setDefault(req, res, next));
