/**
 * Bestseller Routes
 * Public endpoints for bestseller products
 */

import { Router } from 'express';
import { bestsellerController } from '../controllers/bestseller.controller.js';

export const bestsellerRouter = Router();

/**
 * GET /v1/bestsellers
 * List bestseller products
 */
bestsellerRouter.get('/', bestsellerController.list);
