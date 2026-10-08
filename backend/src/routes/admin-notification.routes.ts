import { Router } from 'express';
import { authorize } from '../middlewares/auth.middleware.js';
import { adminNotificationController } from '../controllers/admin-notification.controller.js';

const router = Router();

// Protect all routes: ADMIN or SUPER_ADMIN only
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/', adminNotificationController.listNotifications);
router.get('/:id', adminNotificationController.getNotification);

export const adminNotificationRouter = router;
