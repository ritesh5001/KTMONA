import type { NextFunction, Request, Response } from 'express';
export declare const supportController: {
    createTicket: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    listTickets: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getTicket: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    listMessages: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    sendMessage: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    markRead: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateTicket: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    unreadSummary: (req: Request, res: Response, next: NextFunction) => Promise<void>;
};
//# sourceMappingURL=support.controller.d.ts.map