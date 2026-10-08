/**
 * User Notification Controller
 *
 * Endpoints for authenticated users (buyers/sellers) to manage their notifications.
 * - GET  /v1/notifications           — paginated list
 * - GET  /v1/notifications/unread-count — badge count
 * - PATCH /v1/notifications/:id/read  — mark single notification as read
 */

import { Request, Response, NextFunction } from 'express';
import { notificationRepository } from '../notifications/notification.repository.js';
import { CACHE_KEYS, getFromCache, invalidateCache, invalidateCacheByPattern, setCache } from '../utils/cache.util.js';

const NOTIFICATION_CACHE_TTL_SECONDS = 20;

export class NotificationController {

    /**
     * GET /v1/notifications?page=1&limit=20
     * Returns paginated notifications for the authenticated user.
     */
    async listNotifications(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }

            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
            const cacheKey = CACHE_KEYS.USER_NOTIFICATIONS(userId, page, limit);
            const cached = await getFromCache<{
                success: true;
                data: Array<Record<string, unknown>>;
                meta: { total: number; page: number; limit: number };
            }>(cacheKey);
            if (cached) {
                res.set('Cache-Control', 'no-store');
                res.status(200).json(cached);
                return;
            }

            const result = await notificationRepository.findByUserId(userId, page, limit);

            // Map to client-friendly format
            const data = result.notifications.map((n) => {
                const meta = (n.metadata as any) ?? {};
                return {
                    id: n.id,
                    type: n.type,
                    title: n.subject ?? n.content,
                    message: n.content,
                    isRead: n.isRead,
                    createdAt: n.createdAt.toISOString(),
                    meta: {
                        orderId: meta.orderId ?? undefined,
                        ...meta,
                    },
                };
            });

            const response = {
                success: true,
                data,
                meta: {
                    total: result.total,
                    page,
                    limit,
                },
            } as const;

            await setCache(cacheKey, response, NOTIFICATION_CACHE_TTL_SECONDS);
            res.set('Cache-Control', 'no-store');
            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /v1/notifications/unread-count
     * Returns the count of unread notifications for badge display.
     */
    async getUnreadCount(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }

            const cacheKey = CACHE_KEYS.USER_UNREAD_NOTIFICATIONS(userId);
            const cached = await getFromCache<{ success: true; data: { count: number } }>(cacheKey);
            if (cached) {
                res.set('Cache-Control', 'no-store');
                res.status(200).json(cached);
                return;
            }

            const count = await notificationRepository.countUnread(userId);
            const response = {
                success: true,
                data: { count },
            } as const;
            await setCache(cacheKey, response, NOTIFICATION_CACHE_TTL_SECONDS);
            res.set('Cache-Control', 'no-store');
            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /v1/notifications/:id/read
     * Marks a single notification as read for the authenticated user.
     */
    async markAsRead(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }

            const { id } = req.params;
            const notification = await notificationRepository.markAsRead(id as string, userId);

            if (!notification) {
                res.status(404).json({ success: false, message: 'Notification not found' });
                return;
            }

            await Promise.allSettled([
                invalidateCache(CACHE_KEYS.USER_UNREAD_NOTIFICATIONS(userId)),
                invalidateCacheByPattern(`notifications:user:${userId}:*`),
            ]);

            res.status(200).json({
                success: true,
                data: {
                    id: notification.id,
                    isRead: notification.isRead,
                    readAt: notification.readAt?.toISOString() ?? null,
                },
            });
        } catch (error) {
            next(error);
        }
    }
}

export const notificationController = new NotificationController();
