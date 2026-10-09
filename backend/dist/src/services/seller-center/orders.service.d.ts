/**
 * Seller orders, Meesho-style: Pending → Ready to Ship → Shipped → Delivered,
 * plus Cancelled and RTO. A seller's "sub-order" is their items in an order
 * and their shipment for it.
 */
import { ShipmentStatus } from '@prisma/client';
export declare const ORDER_TABS: readonly ["pending", "ready_to_ship", "shipped", "delivered", "cancelled", "rto", "all"];
export type OrderTab = (typeof ORDER_TABS)[number];
declare class SellerOrdersService {
    counts(sellerId: string): Promise<Record<OrderTab, number>>;
    list(sellerId: string, query: Record<string, unknown>): Promise<{
        tab: "cancelled" | "pending" | "ready_to_ship" | "shipped" | "delivered" | "rto" | "all";
        counts: Record<"cancelled" | "pending" | "ready_to_ship" | "shipped" | "delivered" | "rto" | "all", number>;
        orders: {
            orderId: string;
            orderDate: Date;
            status: string;
            dispatchBy: Date;
            slaBreached: boolean;
            lateDispatch: boolean;
            paymentMode: string;
            customer: {
                name: string | null;
                city: string | null;
                pincode: string | null;
            };
            items: {
                id: string;
                productId: string;
                title: string;
                image: string | null;
                size: string | null;
                color: string | null;
                sku: string | null;
                quantity: number;
                sellerPrice: number;
                lineTotal: number;
            }[];
            sellerAmount: number;
            units: number;
            shipment: {
                id: string;
                status: ShipmentStatus;
                mode: import(".prisma/client").FulfillmentMode;
                carrier: string;
                awb: string | null;
                labelUrl: string | null;
                manifestId: string | null;
                shippedAt: Date | null;
                deliveredAt: Date | null;
                rtoInitiatedAt: Date | null;
                rtoDeliveredAt: Date | null;
                rtoReason: string | null;
            } | null;
            customerCancellation: {
                id: string;
                status: import(".prisma/client").CancellationStatus;
                reason: string;
                createdAt: Date;
            } | null;
            expectedPayoutDate: Date | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    detail(sellerId: string, orderId: string): Promise<{
        timeline: {
            status: ShipmentStatus;
            note: string | null;
            at: Date;
        }[];
        orderId?: string;
        orderDate?: Date;
        status?: string;
        dispatchBy?: Date;
        slaBreached?: boolean;
        lateDispatch?: boolean;
        paymentMode?: string;
        customer?: {
            name: string | null;
            city: string | null;
            pincode: string | null;
        };
        items?: {
            id: string;
            productId: string;
            title: string;
            image: string | null;
            size: string | null;
            color: string | null;
            sku: string | null;
            quantity: number;
            sellerPrice: number;
            lineTotal: number;
        }[];
        sellerAmount?: number;
        units?: number;
        shipment?: {
            id: string;
            status: ShipmentStatus;
            mode: import(".prisma/client").FulfillmentMode;
            carrier: string;
            awb: string | null;
            labelUrl: string | null;
            manifestId: string | null;
            shippedAt: Date | null;
            deliveredAt: Date | null;
            rtoInitiatedAt: Date | null;
            rtoDeliveredAt: Date | null;
            rtoReason: string | null;
        } | null;
        customerCancellation?: {
            id: string;
            status: import(".prisma/client").CancellationStatus;
            reason: string;
            createdAt: Date;
        } | null;
        expectedPayoutDate?: Date | null;
    }>;
    private toRows;
    /** Accept pending orders: create the shipment and generate the label. */
    accept(sellerId: string, orderIds: string[]): Promise<{
        results: {
            orderId: string;
            ok: boolean;
            error?: string;
        }[];
        mode: string;
    }>;
    private book;
    /** Self-ship: record the courier and AWB before handing over. */
    updateTracking(sellerId: string, orderId: string, carrier: string, awb: string): Promise<{
        ok: boolean;
    }>;
    /** Parcel handed to the courier. */
    markShipped(sellerId: string, orderIds: string[]): Promise<{
        results: {
            orderId: string;
            ok: boolean;
            error?: string;
        }[];
    }>;
    /** Seller marks the parcel delivered (self-ship only; Shiprocket reports it). */
    markDelivered(sellerId: string, orderId: string): Promise<{
        ok: boolean;
    }>;
    cancel(sellerId: string, orderId: string, reason: string): Promise<{
        ok: boolean;
        needsAdminApproval: boolean;
    }>;
    approveCustomerCancellation(sellerId: string, orderId: string): Promise<{
        success: boolean;
        orderId: string;
        paymentStatus: import(".prisma/client").PaymentStatus | null;
        refundTriggered: boolean;
        alreadyCancelled: boolean;
    }>;
    /** RTO: courier is returning the parcel (initiated) / seller got it back (received). */
    rto(sellerId: string, orderId: string, action: 'initiated' | 'received', reason?: string): Promise<{
        ok: boolean;
    }>;
    labelsPdf(sellerId: string, orderIds: string[]): Promise<Buffer>;
    /** Group ready-to-ship parcels into a pickup manifest. */
    manifestPdf(sellerId: string, orderIds: string[]): Promise<{
        pdf: Buffer;
        manifestId: string;
    }>;
}
export declare const sellerOrdersService: SellerOrdersService;
export {};
//# sourceMappingURL=orders.service.d.ts.map