/**
 * User Notification Routes
 *
 * Endpoints for authenticated users to view, manage, and mark-as-read
 * their notifications. Available to all authenticated roles.
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { notificationController } from '../controllers/notification.controller.js';

const router = Router();

// All routes require authentication (any role)
router.use(authenticate);

// GET  /v1/notifications               — paginated notification list
router.get('/', notificationController.listNotifications);

// GET  /v1/notifications/unread-count   — badge count
router.get('/unread-count', notificationController.getUnreadCount);

// PATCH /v1/notifications/:id/read      — mark as read
router.patch('/:id/read', notificationController.markAsRead);

export const notificationRouter = router;
