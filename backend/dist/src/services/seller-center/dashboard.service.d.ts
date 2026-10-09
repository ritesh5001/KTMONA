/**
 * Seller dashboard (home): stat cards, sales chart, order status, recent
 * orders, top sellers and action items.
 */
declare class SellerDashboardService {
    overview(sellerId: string, rangeDays?: number): Promise<{
        seller: {
            id: string;
            code: string;
            storeName: string | null;
            storeLogo: string | null;
            email: string | null;
            phone: string | null;
            accountStatus: import(".prisma/client").UserStatus | null;
            kycStatus: import(".prisma/client").KycStatus;
            vacationMode: boolean;
        };
        rangeDays: number;
        stats: {
            totalOrders: {
                value: number;
                change: number | null;
            };
            totalSales: {
                value: number;
                change: number | null;
            };
            activeProducts: {
                value: number;
                addedInRange: number;
            };
            rating: {
                value: number | null;
                reviews: number;
            };
        };
        series: {
            date: Date;
            sales: number;
            orders: number;
        }[];
        orderStatus: {
            pending: number;
            readyToShip: number;
            shipped: number;
            delivered: number;
            cancelled: number;
            rto: number;
        };
        recentOrders: {
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
                status: import(".prisma/client").ShipmentStatus;
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
        topProducts: {
            id: string;
            title: string;
            image: string | null;
            price: number | null;
            sellerPrice: number | null;
            sold: number;
        }[];
        payments: {
            nextPayout: {
                date: Date | null;
                amount: number;
            };
            upcoming: {
                amount: number;
                orders: number;
            };
            netPayable: number;
        };
        checklist: {
            key: string;
            label: string;
            done: boolean;
            href: string;
        }[];
        alerts: {
            tone: "danger" | "warning" | "info";
            text: string;
            href: string;
        }[];
    }>;
    private topProducts;
}
export declare const sellerDashboardService: SellerDashboardService;
export {};
//# sourceMappingURL=dashboard.service.d.ts.map