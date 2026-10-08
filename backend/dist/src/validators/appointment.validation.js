import { z } from 'zod';
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const monthMap = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
};
function normalizeDateInput(value) {
    const raw = value.trim();
    if (dateRegex.test(raw)) {
        return raw;
    }
    const compact = raw.replace(/\s+/g, '');
    const ddMmmYyyyMatch = compact.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (ddMmmYyyyMatch) {
        const [, dayText, monthText, yearText] = ddMmmYyyyMatch;
        if (!dayText || !monthText || !yearText) {
            return null;
        }
        const day = Number(dayText);
        const month = monthMap[monthText.toLowerCase()];
        const year = Number(yearText);
        if (!month || day < 1 || day > 31) {
            return null;
        }
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
}
function normalizeTimeInput(value) {
    const raw = value.trim();
    if (timeRegex.test(raw)) {
        return raw;
    }
    const amPmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (!amPmMatch) {
        return null;
    }
    const [, hourText, minuteText, meridiemText] = amPmMatch;
    if (!hourText || !minuteText || !meridiemText) {
        return null;
    }
    const hour12 = Number(hourText);
    const minute = Number(minuteText);
    const meridiem = meridiemText.toUpperCase();
    if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) {
        return null;
    }
    let hour24 = hour12 % 12;
    if (meridiem === 'PM') {
        hour24 += 12;
    }
    return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function dateInputSchema(fieldName) {
    return z.string().transform((value, ctx) => {
        const normalized = normalizeDateInput(value);
        if (!normalized) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${fieldName} must be in YYYY-MM-DD format`,
            });
            return z.NEVER;
        }
        return normalized;
    });
}
function timeInputSchema(fieldName) {
    return z.string().transform((value, ctx) => {
        const normalized = normalizeTimeInput(value);
        if (!normalized) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${fieldName} must be in HH:mm format`,
            });
            return z.NEVER;
        }
        return normalized;
    });
}
export const createAppointmentSchema = z.object({
    sellerId: z.string().min(1, 'sellerId is required'),
    productId: z.string().min(1).optional(),
    date: dateInputSchema('date'),
    time: timeInputSchema('time'),
    notes: z.string().max(500, 'notes must be at most 500 characters').optional(),
});
export const updateAppointmentStatusSchema = z.object({
    appointmentId: z.string().min(1, 'appointmentId is required'),
    status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
});
export const rescheduleAppointmentSchema = z.object({
    appointmentId: z.string().min(1, 'appointmentId is required'),
    date: dateInputSchema('date'),
    time: timeInputSchema('time'),
});
export const blockSellerSchema = z.object({
    sellerId: z.string().min(1, 'sellerId is required'),
});
export const upsertSellerAvailabilitySchema = z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, 'startTime must be in HH:mm format'),
    endTime: z.string().regex(timeRegex, 'endTime must be in HH:mm format'),
    isActive: z.boolean().optional().default(true),
});
//# sourceMappingURL=appointment.validation.js.map