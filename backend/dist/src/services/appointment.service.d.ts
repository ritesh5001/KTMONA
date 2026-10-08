import type { Role } from '@prisma/client';
import type { BlockSellerInput, CreateAppointmentInput, RescheduleAppointmentInput, UpdateAppointmentStatusInput, UpsertSellerAvailabilityInput } from '../validators/appointment.validation.js';
type ActorContext = {
    userId: string;
    role: Role;
};
export declare class AppointmentService {
    /**
     * Flip appointments whose slot has ended to COMPLETED.
     *
     * This is a maintenance sweep over the WHOLE table, so it must not run on read
     * paths: it was previously awaited by every appointment list, meaning each seller
     * opening their appointments page triggered a full scan plus writes. It stays on
     * the write paths (create / status change / reschedule), where a stale BOOKED row
     * would otherwise affect slot availability, and is also run periodically from the
     * server scheduler.
     */
    autoCompletePastAppointments(): Promise<void>;
    /**
     * Existence/role check only.
     *
     * assertSeller() also pulls in seller_profiles, which Prisma resolves as a second
     * statement — a wasted cross-region round-trip on the callers that discard the
     * result and only need "is this a real seller?".
     */
    private assertSellerExists;
    private assertSeller;
    private assertBuyer;
    private ensureSlotAvailable;
    createAppointment(userId: string, input: CreateAppointmentInput): Promise<{
        appointment: {
            id: any;
            userId: any;
            sellerId: any;
            productId: any;
            date: any;
            time: any;
            status: any;
            whatsappNumber: any;
            whatsappLink: string;
            startsAt: Date;
            endsAt: Date;
            joinWindowStart: Date;
            joinActive: boolean;
            callStartsSoon: boolean;
            notes: any;
            createdAt: any;
            updatedAt: any;
            user: any;
            seller: any;
            product: any;
        };
    }>;
    listUserAppointments(userId: string): Promise<{
        appointments: {
            id: any;
            userId: any;
            sellerId: any;
            productId: any;
            date: any;
            time: any;
            status: any;
            whatsappNumber: any;
            whatsappLink: string;
            startsAt: Date;
            endsAt: Date;
            joinWindowStart: Date;
            joinActive: boolean;
            callStartsSoon: boolean;
            notes: any;
            createdAt: any;
            updatedAt: any;
            user: any;
            seller: any;
            product: any;
        }[];
    }>;
    listSellerAppointments(sellerId: string): Promise<{
        appointments: {
            id: any;
            userId: any;
            sellerId: any;
            productId: any;
            date: any;
            time: any;
            status: any;
            whatsappNumber: any;
            whatsappLink: string;
            startsAt: Date;
            endsAt: Date;
            joinWindowStart: Date;
            joinActive: boolean;
            callStartsSoon: boolean;
            notes: any;
            createdAt: any;
            updatedAt: any;
            user: any;
            seller: any;
            product: any;
        }[];
    }>;
    listAdminAppointments(): Promise<{
        appointments: {
            id: any;
            userId: any;
            sellerId: any;
            productId: any;
            date: any;
            time: any;
            status: any;
            whatsappNumber: any;
            whatsappLink: string;
            startsAt: Date;
            endsAt: Date;
            joinWindowStart: Date;
            joinActive: boolean;
            callStartsSoon: boolean;
            notes: any;
            createdAt: any;
            updatedAt: any;
            user: any;
            seller: any;
            product: any;
        }[];
    }>;
    updateAppointmentStatus(actor: ActorContext, input: UpdateAppointmentStatusInput): Promise<{
        appointment: {
            id: any;
            userId: any;
            sellerId: any;
            productId: any;
            date: any;
            time: any;
            status: any;
            whatsappNumber: any;
            whatsappLink: string;
            startsAt: Date;
            endsAt: Date;
            joinWindowStart: Date;
            joinActive: boolean;
            callStartsSoon: boolean;
            notes: any;
            createdAt: any;
            updatedAt: any;
            user: any;
            seller: any;
            product: any;
        };
    }>;
    rescheduleAppointment(actor: ActorContext, input: RescheduleAppointmentInput): Promise<{
        appointment: {
            id: any;
            userId: any;
            sellerId: any;
            productId: any;
            date: any;
            time: any;
            status: any;
            whatsappNumber: any;
            whatsappLink: string;
            startsAt: Date;
            endsAt: Date;
            joinWindowStart: Date;
            joinActive: boolean;
            callStartsSoon: boolean;
            notes: any;
            createdAt: any;
            updatedAt: any;
            user: any;
            seller: any;
            product: any;
        };
    }>;
    blockSeller(actor: ActorContext, input: BlockSellerInput): Promise<{
        message: string;
        sellerId: string;
        cancelledAppointments: number;
    }>;
    listSellerAvailability(sellerId: string): Promise<{
        availability: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            dayOfWeek: number;
            startTime: string;
            endTime: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {})[];
    }>;
    upsertSellerAvailability(sellerId: string, input: UpsertSellerAvailabilityInput): Promise<{
        availability: import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            dayOfWeek: number;
            startTime: string;
            endTime: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {};
    }>;
}
export declare const appointmentService: AppointmentService;
export {};
//# sourceMappingURL=appointment.service.d.ts.map