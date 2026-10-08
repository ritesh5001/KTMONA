import { Router } from 'express';
import { imagekitController } from '../controllers/imagekit.controller.js';

/**
 * ImageKit Routes
 * Base path: /v1/imagekit
 */
export const imagekitRouter = Router();

// GET /v1/imagekit/auth - Get ImageKit auth params
imagekitRouter.get('/auth', imagekitController.getAuth);
