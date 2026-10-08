/**
 * User Notification Controller
 *
 * Endpoints for authenticated users (buyers/sellers) to manage their notifications.
 * - GET  /v1/notifications           — paginated list
 * - GET  /v1/notifications/unread-count — badge count
 * - PATCH /v1/notifications/:id/read  — mark single notification as read
 */
import { Request, Response, NextFunction } from 'express';
export declare class NotificationController {
    /**
     * GET /v1/notifications?page=1&limit=20
     * Returns paginated notifications for the authenticated user.
     */
    listNotifications(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v1/notifications/unread-count
     * Returns the count of unread notifications for badge display.
     */
    getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /v1/notifications/:id/read
     * Marks a single notification as read for the authenticated user.
     */
    markAsRead(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const notificationController: NotificationController;
//# sourceMappingURL=notification.controller.d.ts.map