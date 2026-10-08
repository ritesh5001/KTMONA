import { prisma } from '../config/db.js';
import { Prisma, Payment, PaymentEvent, PaymentStatus, PaymentEventType } from '@prisma/client';

const paymentLookupSelect = {
    id: true,
    orderId: true,
    userId: true,
    amount: true,
    currency: true,
    status: true,
    provider: true,
    providerOrderId: true,
    providerPaymentId: true,
    providerSignature: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.PaymentSelect;

type PaymentLookup = Prisma.PaymentGetPayload<{
    select: typeof paymentLookupSelect;
}>;

export class PaymentRepository {

    async createPayment(data: {
        orderId: string;
        userId: string;
        amount: number;
        currency: string;
        provider: any;
        status: PaymentStatus;
        providerOrderId?: string;
    }): Promise<Payment> {
        return prisma.payment.create({
            data
        });
    }

    async findPaymentByOrderId(orderId: string): Promise<PaymentLookup | null> {
        return prisma.payment.findUnique({
            where: { orderId },
            select: paymentLookupSelect,
        });
    }

    async findPaymentById(paymentId: string): Promise<PaymentLookup | null> {
        return prisma.payment.findUnique({
            where: { id: paymentId },
            select: paymentLookupSelect,
        });
    }

    async findByProviderOrderId(providerOrderId: string): Promise<PaymentLookup | null> {
        return prisma.payment.findFirst({
            where: { providerOrderId },
            select: paymentLookupSelect,
        });
    }

    async updatePaymentStatus(
        paymentId: string,
        status: PaymentStatus,
        providerPaymentId?: string | null
    ): Promise<Payment> {
        const data: any = { status };
        if (providerPaymentId) {
            data.providerPaymentId = providerPaymentId;
        }

        return prisma.payment.update({
            where: { id: paymentId },
            data
        });
    }

    async updateProviderOrderId(paymentId: string, providerOrderId: string): Promise<Payment> {
        return prisma.payment.update({
            where: { id: paymentId },
            data: { providerOrderId }
        });
    }

    async updatePaymentWithSignature(
        paymentId: string,
        status: PaymentStatus,
        providerPaymentId: string,
        providerSignature?: string
    ): Promise<Payment> {
        const data: any = { status, providerPaymentId };
        if (providerSignature) {
            data.providerSignature = providerSignature;
        }

        return prisma.payment.update({
            where: { id: paymentId },
            data
        });
    }

    async createPaymentEvent(data: {
        paymentId: string;
        type: PaymentEventType;
        payload?: any;
    }): Promise<PaymentEvent> {
        return prisma.paymentEvent.create({
            data: {
                paymentId: data.paymentId,
                type: data.type,
                payload: data.payload || {}
            }
        });
    }
}

export const paymentRepository = new PaymentRepository();
