import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors/ApiError.js';
import { appointmentService } from '../services/appointment.service.js';
import {
  blockSellerSchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentStatusSchema,
  upsertSellerAvailabilitySchema,
} from '../validators/appointment.validation.js';

function handleValidation(error: unknown, next: NextFunction): boolean {
  if (!(error instanceof ZodError)) {
    return false;
  }

  const details = error.errors.reduce((acc, err) => {
    const key = err.path.join('.');
    acc[key] = err.message;
    return acc;
  }, {} as Record<string, string>);

  next(ApiError.badRequest('Validation failed', details));
  return true;
}

export class AppointmentController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const validated = createAppointmentSchema.parse(req.body);
      const result = await appointmentService.createAppointment(userId, validated);
      res.status(201).json(result);
    } catch (error) {
      if (handleValidation(error, next)) return;
      next(error);
    }
  }

  async listUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await appointmentService.listUserAppointments(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listSeller(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sellerId = req.user!.userId;
      const result = await appointmentService.listSellerAppointments(sellerId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listAdmin(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await appointmentService.listAdminAppointments();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateAppointmentStatusSchema.parse(req.body);
      const result = await appointmentService.updateAppointmentStatus(
        { userId: req.user!.userId, role: req.user!.role },
        validated,
      );
      res.json(result);
    } catch (error) {
      if (handleValidation(error, next)) return;
      next(error);
    }
  }

  async reschedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = rescheduleAppointmentSchema.parse(req.body);
      const result = await appointmentService.rescheduleAppointment(
        { userId: req.user!.userId, role: req.user!.role },
        validated,
      );
      res.json(result);
    } catch (error) {
      if (handleValidation(error, next)) return;
      next(error);
    }
  }

  async blockSeller(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = blockSellerSchema.parse(req.body);
      const result = await appointmentService.blockSeller(
        { userId: req.user!.userId, role: req.user!.role },
        validated,
      );
      res.json(result);
    } catch (error) {
      if (handleValidation(error, next)) return;
      next(error);
    }
  }

  async listSellerAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sellerId = req.user!.userId;
      const result = await appointmentService.listSellerAvailability(sellerId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async upsertSellerAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sellerId = req.user!.userId;
      const validated = upsertSellerAvailabilitySchema.parse(req.body);
      const result = await appointmentService.upsertSellerAvailability(sellerId, validated);
      res.status(201).json(result);
    } catch (error) {
      if (handleValidation(error, next)) return;
      next(error);
    }
  }
}

export const appointmentController = new AppointmentController();
