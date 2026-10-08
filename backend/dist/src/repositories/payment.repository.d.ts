import { Prisma, Payment, PaymentEvent, PaymentStatus, PaymentEventType } from '@prisma/client';
declare const paymentLookupSelect: {
    id: true;
    orderId: true;
    userId: true;
    amount: true;
    currency: true;
    status: true;
    provider: true;
    providerOrderId: true;
    providerPaymentId: true;
    providerSignature: true;
    createdAt: true;
    updatedAt: true;
};
type PaymentLookup = Prisma.PaymentGetPayload<{
    select: typeof paymentLookupSelect;
}>;
export declare class PaymentRepository {
    createPayment(data: {
        orderId: string;
        userId: string;
        amount: number;
        currency: string;
        provider: any;
        status: PaymentStatus;
        providerOrderId?: string;
    }): Promise<Payment>;
    findPaymentByOrderId(orderId: string): Promise<PaymentLookup | null>;
    findPaymentById(paymentId: string): Promise<PaymentLookup | null>;
    findByProviderOrderId(providerOrderId: string): Promise<PaymentLookup | null>;
    updatePaymentStatus(paymentId: string, status: PaymentStatus, providerPaymentId?: string | null): Promise<Payment>;
    updateProviderOrderId(paymentId: string, providerOrderId: string): Promise<Payment>;
    updatePaymentWithSignature(paymentId: string, status: PaymentStatus, providerPaymentId: string, providerSignature?: string): Promise<Payment>;
    createPaymentEvent(data: {
        paymentId: string;
        type: PaymentEventType;
        payload?: any;
    }): Promise<PaymentEvent>;
}
export declare const paymentRepository: PaymentRepository;
export {};
//# sourceMappingURL=payment.repository.d.ts.map