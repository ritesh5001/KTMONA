import { Request, Response, NextFunction } from 'express';
export declare class AdminNotificationController {
    /**
     * List all notifications (Admin only)
     */
    listNotifications(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get single notification details
     */
    getNotification(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const adminNotificationController: AdminNotificationController;
//# sourceMappingURL=admin-notification.controller.d.ts.map