import { prisma } from '../config/db.js';
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
};
export class PaymentRepository {
    async createPayment(data) {
        return prisma.payment.create({
            data
        });
    }
    async findPaymentByOrderId(orderId) {
        return prisma.payment.findUnique({
            where: { orderId },
            select: paymentLookupSelect,
        });
    }
    async findPaymentById(paymentId) {
        return prisma.payment.findUnique({
            where: { id: paymentId },
            select: paymentLookupSelect,
        });
    }
    async findByProviderOrderId(providerOrderId) {
        return prisma.payment.findFirst({
            where: { providerOrderId },
            select: paymentLookupSelect,
        });
    }
    async updatePaymentStatus(paymentId, status, providerPaymentId) {
        const data = { status };
        if (providerPaymentId) {
            data.providerPaymentId = providerPaymentId;
        }
        return prisma.payment.update({
            where: { id: paymentId },
            data
        });
    }
    async updateProviderOrderId(paymentId, providerOrderId) {
        return prisma.payment.update({
            where: { id: paymentId },
            data: { providerOrderId }
        });
    }
    async updatePaymentWithSignature(paymentId, status, providerPaymentId, providerSignature) {
        const data = { status, providerPaymentId };
        if (providerSignature) {
            data.providerSignature = providerSignature;
        }
        return prisma.payment.update({
            where: { id: paymentId },
            data
        });
    }
    async createPaymentEvent(data) {
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
//# sourceMappingURL=payment.repository.js.map