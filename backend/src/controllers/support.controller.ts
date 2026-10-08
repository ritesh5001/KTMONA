import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../errors/ApiError.js';
import { supportService } from '../services/support.service.js';
import {
    createSupportTicketSchema,
    sendSupportMessageSchema,
    supportMessageListQuerySchema,
    supportTicketIdParamSchema,
    supportTicketListQuerySchema,
    updateSupportTicketSchema,
} from '../validators/support.validation.js';

const requireViewer = (req: Request) => {
    const user = req.user;
    if (!user?.userId) {
        throw ApiError.unauthorized('Authentication required');
    }
    return { id: user.userId, role: user.role };
};

export const supportController = {
    createTicket: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const viewer = requireViewer(req);
            const input = createSupportTicketSchema.parse(req.body);
            const result = await supportService.createTicket(viewer.id, viewer.role, input);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    },

    listTickets: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const viewer = requireViewer(req);
            const query = supportTicketListQuerySchema.parse(req.query);
            const result = await supportService.listTickets(viewer.id, viewer.role, query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    getTicket: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const viewer = requireViewer(req);
            const { id } = supportTicketIdParamSchema.parse(req.params);
            const ticket = await supportService.getTicket(id, viewer.id, viewer.role);
            res.json({ ticket });
        } catch (error) {
            next(error);
        }
    },

    listMessages: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const viewer = requireViewer(req);
            const { id } = supportTicketIdParamSchema.parse(req.params);
            const query = supportMessageListQuerySchema.parse(req.query);
            const result = await supportService.listMessages(id, viewer.id, viewer.role, query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    sendMessage: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const viewer = requireViewer(req);
            const { id } = supportTicketIdParamSchema.parse(req.params);
            const input = sendSupportMessageSchema.parse(req.body);
            const result = await supportService.sendMessage(id, viewer.id, viewer.role, input);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    },

    markRead: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const viewer = requireViewer(req);
            const { id } = supportTicketIdParamSchema.parse(req.params);
            const result = await supportService.markRead(id, viewer.id, viewer.role);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    updateTicket: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const viewer = requireViewer(req);
            const { id } = supportTicketIdParamSchema.parse(req.params);
            const input = updateSupportTicketSchema.parse(req.body);
            const ticket = await supportService.updateTicket(id, viewer.id, viewer.role, input);
            res.json({ ticket });
        } catch (error) {
            next(error);
        }
    },

    unreadSummary: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const viewer = requireViewer(req);
            const summary = await supportService.unreadSummary(viewer.id, viewer.role);
            res.json(summary);
        } catch (error) {
            next(error);
        }
    },
};
