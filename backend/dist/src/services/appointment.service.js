import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { notificationService } from '../notifications/notification.service.js';
const ACTIVE_BOOKED_STATUSES = ['PENDING', 'CONFIRMED'];
const APPOINTMENT_DURATION_MINUTES = 60;
function timeToMinutes(value) {
    const [hoursRaw = '0', minutesRaw = '0'] = value.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    return hours * 60 + minutes;
}
function normalizeWhatsappNumber(raw) {
    return raw.replace(/\D/g, '');
}
function toWhatsappLink(raw) {
    return `https://wa.me/${normalizeWhatsappNumber(raw)}`;
}
function parseDateOnly(value) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw ApiError.badRequest('Invalid appointment date');
    }
    return parsed;
}
function getAppointmentStart(date, time) {
    const datePart = date.toISOString().slice(0, 10);
    return new Date(`${datePart}T${time}:00`);
}
function getAppointmentEnd(date, time) {
    const start = getAppointmentStart(date, time);
    return new Date(start.getTime() + APPOINTMENT_DURATION_MINUTES * 60 * 1000);
}
function formatAppointment(row) {
    const now = Date.now();
    const startAt = getAppointmentStart(row.date, row.time);
    const joinWindowStart = new Date(startAt.getTime() - 10 * 60 * 1000);
    const endsAt = getAppointmentEnd(row.date, row.time);
    const joinActive = row.status !== 'CANCELLED' &&
        row.status !== 'COMPLETED' &&
        now >= joinWindowStart.getTime() &&
        now <= endsAt.getTime();
    const callStartsSoon = row.status !== 'CANCELLED' &&
        row.status !== 'COMPLETED' &&
        now >= joinWindowStart.getTime() &&
        now < startAt.getTime();
    return {
        id: row.id,
        userId: row.userId,
        sellerId: row.sellerId,
        productId: row.productId,
        date: row.date,
        time: row.time,
        status: row.status,
        whatsappNumber: row.whatsappNumber,
        whatsappLink: toWhatsappLink(row.whatsappNumber),
        startsAt: startAt,
        endsAt,
        joinWindowStart,
        joinActive,
        callStartsSoon,
        notes: row.notes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        user: row.user,
        seller: row.seller,
        product: row.product,
    };
}
export class AppointmentService {
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
    async autoCompletePastAppointments() {
        const now = new Date();
        const candidates = await prisma.appointment.findMany({
            where: {
                status: { in: ACTIVE_BOOKED_STATUSES },
                date: { lte: now },
            },
            select: { id: true, date: true, time: true },
        });
        const completedIds = candidates
            .filter((item) => getAppointmentEnd(item.date, item.time).getTime() <= now.getTime())
            .map((item) => item.id);
        if (completedIds.length === 0)
            return;
        await prisma.appointment.updateMany({
            where: { id: { in: completedIds } },
            data: { status: 'COMPLETED' },
        });
    }
    /**
     * Existence/role check only.
     *
     * assertSeller() also pulls in seller_profiles, which Prisma resolves as a second
     * statement — a wasted cross-region round-trip on the callers that discard the
     * result and only need "is this a real seller?".
     */
    async assertSellerExists(sellerId) {
        const seller = await prisma.user.findFirst({
            where: { id: sellerId, role: 'SELLER' },
            select: { id: true },
        });
        if (!seller) {
            throw ApiError.notFound('Seller not found');
        }
    }
    async assertSeller(sellerId) {
        const seller = await prisma.user.findFirst({
            where: { id: sellerId, role: 'SELLER' },
            select: {
                id: true,
                email: true,
                phone: true,
                whatsappNumber: true,
                seller_profiles: { select: { store_name: true } },
            },
        });
        if (!seller) {
            throw ApiError.notFound('Seller not found');
        }
        if (!seller.whatsappNumber || normalizeWhatsappNumber(seller.whatsappNumber).length < 10) {
            throw ApiError.badRequest('Seller WhatsApp number is not configured');
        }
        return seller;
    }
    async assertBuyer(userId) {
        const user = await prisma.user.findFirst({
            where: { id: userId, role: 'USER' },
            select: { id: true, email: true, phone: true },
        });
        if (!user) {
            throw ApiError.notFound('User not found');
        }
        return user;
    }
    async ensureSlotAvailable(sellerId, date, time, excludeAppointmentId) {
        const dayOfWeek = date.getUTCDay();
        const requestedTime = timeToMinutes(time);
        const availabilityRows = await prisma.sellerAvailability.findMany({
            where: {
                sellerId,
                dayOfWeek,
                isActive: true,
            },
            select: {
                startTime: true,
                endTime: true,
            },
        });
        if (availabilityRows.length === 0) {
            const hasAnyActiveAvailability = await prisma.sellerAvailability.findFirst({
                where: {
                    sellerId,
                    isActive: true,
                },
                select: { id: true },
            });
            // Backward-compatibility fallback: if seller has not configured any
            // availability yet, do not block customer booking.
            if (!hasAnyActiveAvailability) {
                return;
            }
            throw ApiError.badRequest('Requested time is outside seller availability');
        }
        const isWithinAvailability = availabilityRows.some((slot) => {
            const start = timeToMinutes(slot.startTime);
            const end = timeToMinutes(slot.endTime);
            return requestedTime >= start && requestedTime < end;
        });
        if (!isWithinAvailability) {
            throw ApiError.badRequest('Requested time is outside seller availability');
        }
        const existing = await prisma.appointment.findFirst({
            where: {
                sellerId,
                date,
                time,
                status: { in: ACTIVE_BOOKED_STATUSES },
                ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
            },
            select: { id: true },
        });
        if (existing) {
            throw ApiError.conflict('Selected slot is already booked');
        }
    }
    async createAppointment(userId, input) {
        await this.autoCompletePastAppointments();
        await this.assertBuyer(userId);
        const seller = await this.assertSeller(input.sellerId);
        if (input.productId) {
            const product = await prisma.product.findFirst({
                where: { id: input.productId, sellerId: input.sellerId },
                select: { id: true },
            });
            if (!product) {
                throw ApiError.badRequest('Product does not belong to selected seller');
            }
        }
        const appointmentDate = parseDateOnly(input.date);
        await this.ensureSlotAvailable(input.sellerId, appointmentDate, input.time);
        const created = await prisma.appointment.create({
            data: {
                userId,
                sellerId: input.sellerId,
                productId: input.productId ?? null,
                date: appointmentDate,
                time: input.time,
                status: 'PENDING',
                whatsappNumber: normalizeWhatsappNumber(seller.whatsappNumber),
                notes: input.notes?.trim() || null,
            },
            include: {
                user: { select: { id: true, email: true, phone: true } },
                seller: { select: { id: true, email: true, phone: true, seller_profiles: { select: { store_name: true } } } },
                product: { select: { id: true, title: true } },
            },
        });
        await Promise.allSettled([
            notificationService.create({
                userId,
                role: 'USER',
                type: 'ADMIN_ALERT',
                channel: 'EMAIL',
                content: `Appointment booked for ${input.date} ${input.time}`,
                metadata: {
                    title: 'Appointment Booked',
                    message: `Your video appointment is booked for ${input.date} at ${input.time}.`,
                    email: created.user?.email,
                },
                eventKey: `APPOINTMENT_BOOKED:USER:${created.id}`,
            }),
            notificationService.create({
                userId: input.sellerId,
                role: 'SELLER',
                type: 'ADMIN_ALERT',
                channel: 'EMAIL',
                content: `New appointment for ${input.date} ${input.time}`,
                metadata: {
                    title: 'New Appointment',
                    message: `A customer booked a video appointment for ${input.date} at ${input.time}.`,
                    email: created.seller?.email,
                },
                eventKey: `APPOINTMENT_BOOKED:SELLER:${created.id}`,
            }),
        ]);
        return { appointment: formatAppointment(created) };
    }
    async listUserAppointments(userId) {
        // Completion sweep intentionally NOT run here — see autoCompletePastAppointments().
        await this.assertBuyer(userId);
        const appointments = await prisma.appointment.findMany({
            where: { userId },
            orderBy: [{ date: 'desc' }, { time: 'desc' }],
            include: {
                seller: { select: { id: true, email: true, phone: true, seller_profiles: { select: { store_name: true } } } },
                product: { select: { id: true, title: true } },
            },
        });
        return { appointments: appointments.map(formatAppointment) };
    }
    async listSellerAppointments(sellerId) {
        // Completion sweep intentionally NOT run here — see autoCompletePastAppointments().
        await this.assertSellerExists(sellerId);
        // One JOIN rather than nested includes. Prisma 4 resolves `user` and `product`
        // as separate statements, so this list cost three round-trips for what is
        // usually a handful of rows — and against a cross-region database each one is
        // ~300ms. The shape below matches the include version exactly.
        const rows = await prisma.$queryRaw `
      SELECT
        a."id", a."user_id" AS "userId", a."seller_id" AS "sellerId",
        a."product_id" AS "productId", a."date", a."time",
        a."status"::text AS "status",
        a."whatsapp_number" AS "whatsappNumber",
        a."notes",
        a."created_at" AS "createdAt",
        a."updated_at" AS "updatedAt",
        u."id"     AS "userIdJoined",
        u."email"  AS "userEmail",
        u."phone"  AS "userPhone",
        p."id"     AS "productIdJoined",
        p."title"  AS "productTitle"
      FROM "appointments" a
      LEFT JOIN "users" u    ON u."id" = a."user_id"
      LEFT JOIN "products" p ON p."id" = a."product_id"
      WHERE a."seller_id" = ${sellerId}
      ORDER BY a."date" DESC, a."time" DESC
    `;
        const appointments = rows.map((row) => ({
            ...row,
            user: row['userIdJoined'] == null
                ? null
                : { id: row['userIdJoined'], email: row['userEmail'], phone: row['userPhone'] },
            product: row['productIdJoined'] == null
                ? null
                : { id: row['productIdJoined'], title: row['productTitle'] },
        }));
        return { appointments: appointments.map(formatAppointment) };
    }
    async listAdminAppointments() {
        // Completion sweep intentionally NOT run here — see autoCompletePastAppointments().
        const appointments = await prisma.appointment.findMany({
            orderBy: [{ date: 'desc' }, { time: 'desc' }],
            include: {
                user: { select: { id: true, email: true, phone: true } },
                seller: { select: { id: true, email: true, phone: true, seller_profiles: { select: { store_name: true } } } },
                product: { select: { id: true, title: true } },
            },
        });
        return { appointments: appointments.map(formatAppointment) };
    }
    async updateAppointmentStatus(actor, input) {
        await this.autoCompletePastAppointments();
        const appointment = await prisma.appointment.findUnique({
            where: { id: input.appointmentId },
            include: {
                user: { select: { id: true, email: true, phone: true } },
                seller: { select: { id: true, email: true, phone: true, seller_profiles: { select: { store_name: true } } } },
                product: { select: { id: true, title: true } },
            },
        });
        if (!appointment) {
            throw ApiError.notFound('Appointment not found');
        }
        if (actor.role === 'USER') {
            if (appointment.userId !== actor.userId) {
                throw ApiError.forbidden('You can only update your appointments');
            }
            if (input.status !== 'CANCELLED') {
                throw ApiError.forbidden('Users can only cancel appointments');
            }
        }
        if (actor.role === 'SELLER' && appointment.sellerId !== actor.userId) {
            throw ApiError.forbidden('You can only update your appointments');
        }
        if (!['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
            throw ApiError.forbidden('Insufficient permissions');
        }
        const updated = await prisma.appointment.update({
            where: { id: appointment.id },
            data: { status: input.status },
            include: {
                user: { select: { id: true, email: true, phone: true } },
                seller: { select: { id: true, email: true, phone: true, seller_profiles: { select: { store_name: true } } } },
                product: { select: { id: true, title: true } },
            },
        });
        return { appointment: formatAppointment(updated) };
    }
    async rescheduleAppointment(actor, input) {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
            throw ApiError.forbidden('Only admin can reschedule appointments');
        }
        await this.autoCompletePastAppointments();
        const appointment = await prisma.appointment.findUnique({
            where: { id: input.appointmentId },
            include: {
                user: { select: { id: true, email: true, phone: true } },
                seller: { select: { id: true, email: true, phone: true, seller_profiles: { select: { store_name: true } } } },
                product: { select: { id: true, title: true } },
            },
        });
        if (!appointment) {
            throw ApiError.notFound('Appointment not found');
        }
        if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
            throw ApiError.badRequest('Cannot reschedule a closed appointment');
        }
        const nextDate = parseDateOnly(input.date);
        await this.ensureSlotAvailable(appointment.sellerId, nextDate, input.time, appointment.id);
        const updated = await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
                date: nextDate,
                time: input.time,
                status: 'CONFIRMED',
            },
            include: {
                user: { select: { id: true, email: true, phone: true } },
                seller: { select: { id: true, email: true, phone: true, seller_profiles: { select: { store_name: true } } } },
                product: { select: { id: true, title: true } },
            },
        });
        return { appointment: formatAppointment(updated) };
    }
    async blockSeller(actor, input) {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
            throw ApiError.forbidden('Only admin can block sellers');
        }
        const seller = await prisma.user.findFirst({
            where: { id: input.sellerId, role: 'SELLER' },
            select: { id: true, status: true },
        });
        if (!seller) {
            throw ApiError.notFound('Seller not found');
        }
        await prisma.user.update({
            where: { id: input.sellerId },
            data: { status: 'SUSPENDED' },
        });
        const today = new Date();
        const cancelled = await prisma.appointment.updateMany({
            where: {
                sellerId: input.sellerId,
                status: { in: ACTIVE_BOOKED_STATUSES },
                date: { gte: today },
            },
            data: { status: 'CANCELLED' },
        });
        return {
            message: 'Seller blocked and active appointments cancelled',
            sellerId: input.sellerId,
            cancelledAppointments: cancelled.count,
        };
    }
    async listSellerAvailability(sellerId) {
        await this.assertSellerExists(sellerId);
        const availability = await prisma.sellerAvailability.findMany({
            where: { sellerId },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });
        return { availability };
    }
    async upsertSellerAvailability(sellerId, input) {
        await this.assertSellerExists(sellerId);
        const start = timeToMinutes(input.startTime);
        const end = timeToMinutes(input.endTime);
        if (start >= end) {
            throw ApiError.badRequest('startTime must be before endTime');
        }
        const existing = await prisma.sellerAvailability.findFirst({
            where: {
                sellerId,
                dayOfWeek: input.dayOfWeek,
                startTime: input.startTime,
                endTime: input.endTime,
            },
            select: { id: true },
        });
        if (existing) {
            const availability = await prisma.sellerAvailability.update({
                where: { id: existing.id },
                data: { isActive: input.isActive ?? true },
            });
            return { availability };
        }
        const availability = await prisma.sellerAvailability.create({
            data: {
                sellerId,
                dayOfWeek: input.dayOfWeek,
                startTime: input.startTime,
                endTime: input.endTime,
                isActive: input.isActive ?? true,
            },
        });
        return { availability };
    }
}
export const appointmentService = new AppointmentService();
//# sourceMappingURL=appointment.service.js.map