import type { NextFunction, Request, Response } from 'express';
export declare class AppointmentController {
    create(req: Request, res: Response, next: NextFunction): Promise<void>;
    listUser(req: Request, res: Response, next: NextFunction): Promise<void>;
    listSeller(req: Request, res: Response, next: NextFunction): Promise<void>;
    listAdmin(_req: Request, res: Response, next: NextFunction): Promise<void>;
    updateStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
    reschedule(req: Request, res: Response, next: NextFunction): Promise<void>;
    blockSeller(req: Request, res: Response, next: NextFunction): Promise<void>;
    listSellerAvailability(req: Request, res: Response, next: NextFunction): Promise<void>;
    upsertSellerAvailability(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const appointmentController: AppointmentController;
//# sourceMappingURL=appointment.controller.d.ts.map