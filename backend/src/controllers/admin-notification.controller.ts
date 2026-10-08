import { Request, Response, NextFunction } from 'express';
import { notificationRepository } from '../notifications/notification.repository.js';

export class AdminNotificationController {
    /**
     * List all notifications (Admin only)
     */
    async listNotifications(req: Request, res: Response, next: NextFunction) {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;

            const result = await notificationRepository.findAll(page, limit);

            res.status(200).json({
                success: true,
                data: result.notifications,
                meta: {
                    total: result.total,
                    page,
                    limit
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get single notification details
     */
    async getNotification(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const notification = await notificationRepository.findById(id as string);

            if (!notification) {
                res.status(404).json({ success: false, message: 'Notification not found' });
                return;
            }

            // Could also fetch events here if we added relation or separate query

            res.status(200).json({
                success: true,
                data: notification
            });
        } catch (error) {
            next(error);
        }
    }
}

export const adminNotificationController = new AdminNotificationController();
