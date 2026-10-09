/**
 * Admin seller management: list with performance, full seller profile,
 * KYC verification, suspension (hides listings), payout hold, commission.
 */
import { Prisma } from '@prisma/client';
export declare const SELLER_TABS: readonly ["all", "pending", "active", "suspended", "kyc_review", "at_risk"];
declare class AdminSellersService {
    private where;
    list(query: Record<string, unknown>): Promise<{
        tab: "active" | "pending" | "all" | "suspended" | "kyc_review" | "at_risk";
        counts: Record<string, number>;
        sellers: {
            id: string;
            sellerCode: string;
            email: string | null;
            phone: string | null;
            status: import(".prisma/client").UserStatus;
            joinedAt: Date;
            storeName: string | null;
            kycStatus: import(".prisma/client").KycStatus;
            gstRegistered: boolean | null;
            payoutHold: boolean;
            liveProducts: number;
            orders30d: number;
            gmv30d: number;
            cancelRate: number | null;
            rating: number | null;
            atRisk: boolean;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    private countAtRisk;
    /** 30-day orders, GMV, seller cancellations, live products and rating per seller. */
    private metrics;
    detail(sellerId: string): Promise<{
        id: string;
        sellerCode: string;
        email: string | null;
        phone: string | null;
        whatsapp: string | null;
        status: import(".prisma/client").UserStatus;
        statusReason: string | null;
        joinedAt: Date;
        store: {
            name: string;
            slug: string;
            description: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        kyc: {
            status: import(".prisma/client").KycStatus;
            rejectionReason: string | null;
            verifiedAt: Date | null;
            businessType: import(".prisma/client").BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            panMatchesGstin: boolean;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
            holderMatchesStore: boolean;
        }[];
        payoutHold: boolean;
        payoutHoldReason: string | null;
        commission: {
            commissionPct: number;
            platformFee: number;
            custom: boolean;
        };
        health: {
            days: number;
            score: number;
            status: string;
            orders: number;
            overdueOrders: number;
            metrics: {
                key: string;
                label: string;
                value: number | null;
                unit: string;
                target: string;
                status: "GOOD" | "AT_RISK" | "POOR" | "NO_DATA";
            }[];
            ratings: {
                average: number | null;
                count: number;
                distribution: {
                    rating: number;
                    count: number;
                }[];
            };
            penalties: {
                id: string;
                amount: number;
                orderId: string | null;
                note: string | null;
                date: Date;
                settled: boolean;
            }[];
            lateDispatchPenalty: number;
            tips: string[];
        };
        products: {
            [k: string]: number;
        };
        lifetime: {
            orders: number;
            gmv: number;
        };
        payoutDue: {
            amount: number;
            settlements: number;
            ledgerAmount: number;
        };
        payouts: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            payoutNumber: string;
            sellerId: string;
            amount: number;
            settlementsAmount: number;
            ledgerAmount: number;
            settlementCount: number;
            ledgerCount: number;
            method: string;
            reference: string | null;
            note: string | null;
            bankSnapshot: Prisma.JsonValue | null;
            createdBy: string;
            createdAt: Date;
        }, unknown> & {})[];
        penalties: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            type: import(".prisma/client").SellerLedgerType;
            amount: number;
            referenceId: string | null;
            orderId: string | null;
            note: string | null;
            entryDate: Date;
            settledAt: Date | null;
            payoutId: string | null;
            waivedAt: Date | null;
            waivedBy: string | null;
            createdAt: Date;
        }, unknown> & {})[];
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
    }>;
    reviewKyc(adminId: string, sellerId: string, input: {
        status: 'VERIFIED' | 'REJECTED';
        reason?: string | undefined;
    }): Promise<{
        id: string;
        sellerCode: string;
        email: string | null;
        phone: string | null;
        whatsapp: string | null;
        status: import(".prisma/client").UserStatus;
        statusReason: string | null;
        joinedAt: Date;
        store: {
            name: string;
            slug: string;
            description: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        kyc: {
            status: import(".prisma/client").KycStatus;
            rejectionReason: string | null;
            verifiedAt: Date | null;
            businessType: import(".prisma/client").BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            panMatchesGstin: boolean;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
            holderMatchesStore: boolean;
        }[];
        payoutHold: boolean;
        payoutHoldReason: string | null;
        commission: {
            commissionPct: number;
            platformFee: number;
            custom: boolean;
        };
        health: {
            days: number;
            score: number;
            status: string;
            orders: number;
            overdueOrders: number;
            metrics: {
                key: string;
                label: string;
                value: number | null;
                unit: string;
                target: string;
                status: "GOOD" | "AT_RISK" | "POOR" | "NO_DATA";
            }[];
            ratings: {
                average: number | null;
                count: number;
                distribution: {
                    rating: number;
                    count: number;
                }[];
            };
            penalties: {
                id: string;
                amount: number;
                orderId: string | null;
                note: string | null;
                date: Date;
                settled: boolean;
            }[];
            lateDispatchPenalty: number;
            tips: string[];
        };
        products: {
            [k: string]: number;
        };
        lifetime: {
            orders: number;
            gmv: number;
        };
        payoutDue: {
            amount: number;
            settlements: number;
            ledgerAmount: number;
        };
        payouts: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            payoutNumber: string;
            sellerId: string;
            amount: number;
            settlementsAmount: number;
            ledgerAmount: number;
            settlementCount: number;
            ledgerCount: number;
            method: string;
            reference: string | null;
            note: string | null;
            bankSnapshot: Prisma.JsonValue | null;
            createdBy: string;
            createdAt: Date;
        }, unknown> & {})[];
        penalties: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            type: import(".prisma/client").SellerLedgerType;
            amount: number;
            referenceId: string | null;
            orderId: string | null;
            note: string | null;
            entryDate: Date;
            settledAt: Date | null;
            payoutId: string | null;
            waivedAt: Date | null;
            waivedBy: string | null;
            createdAt: Date;
        }, unknown> & {})[];
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
    }>;
    /** Approve / reactivate / suspend. Suspension hides every listing. */
    setStatus(adminId: string, sellerId: string, input: {
        status: 'ACTIVE' | 'SUSPENDED';
        reason?: string | undefined;
    }): Promise<{
        id: string;
        sellerCode: string;
        email: string | null;
        phone: string | null;
        whatsapp: string | null;
        status: import(".prisma/client").UserStatus;
        statusReason: string | null;
        joinedAt: Date;
        store: {
            name: string;
            slug: string;
            description: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        kyc: {
            status: import(".prisma/client").KycStatus;
            rejectionReason: string | null;
            verifiedAt: Date | null;
            businessType: import(".prisma/client").BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            panMatchesGstin: boolean;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
            holderMatchesStore: boolean;
        }[];
        payoutHold: boolean;
        payoutHoldReason: string | null;
        commission: {
            commissionPct: number;
            platformFee: number;
            custom: boolean;
        };
        health: {
            days: number;
            score: number;
            status: string;
            orders: number;
            overdueOrders: number;
            metrics: {
                key: string;
                label: string;
                value: number | null;
                unit: string;
                target: string;
                status: "GOOD" | "AT_RISK" | "POOR" | "NO_DATA";
            }[];
            ratings: {
                average: number | null;
                count: number;
                distribution: {
                    rating: number;
                    count: number;
                }[];
            };
            penalties: {
                id: string;
                amount: number;
                orderId: string | null;
                note: string | null;
                date: Date;
                settled: boolean;
            }[];
            lateDispatchPenalty: number;
            tips: string[];
        };
        products: {
            [k: string]: number;
        };
        lifetime: {
            orders: number;
            gmv: number;
        };
        payoutDue: {
            amount: number;
            settlements: number;
            ledgerAmount: number;
        };
        payouts: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            payoutNumber: string;
            sellerId: string;
            amount: number;
            settlementsAmount: number;
            ledgerAmount: number;
            settlementCount: number;
            ledgerCount: number;
            method: string;
            reference: string | null;
            note: string | null;
            bankSnapshot: Prisma.JsonValue | null;
            createdBy: string;
            createdAt: Date;
        }, unknown> & {})[];
        penalties: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            type: import(".prisma/client").SellerLedgerType;
            amount: number;
            referenceId: string | null;
            orderId: string | null;
            note: string | null;
            entryDate: Date;
            settledAt: Date | null;
            payoutId: string | null;
            waivedAt: Date | null;
            waivedBy: string | null;
            createdAt: Date;
        }, unknown> & {})[];
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
    }>;
    setPayoutHold(sellerId: string, input: {
        hold: boolean;
        reason?: string | undefined;
    }): Promise<{
        id: string;
        sellerCode: string;
        email: string | null;
        phone: string | null;
        whatsapp: string | null;
        status: import(".prisma/client").UserStatus;
        statusReason: string | null;
        joinedAt: Date;
        store: {
            name: string;
            slug: string;
            description: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        kyc: {
            status: import(".prisma/client").KycStatus;
            rejectionReason: string | null;
            verifiedAt: Date | null;
            businessType: import(".prisma/client").BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            panMatchesGstin: boolean;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
            holderMatchesStore: boolean;
        }[];
        payoutHold: boolean;
        payoutHoldReason: string | null;
        commission: {
            commissionPct: number;
            platformFee: number;
            custom: boolean;
        };
        health: {
            days: number;
            score: number;
            status: string;
            orders: number;
            overdueOrders: number;
            metrics: {
                key: string;
                label: string;
                value: number | null;
                unit: string;
                target: string;
                status: "GOOD" | "AT_RISK" | "POOR" | "NO_DATA";
            }[];
            ratings: {
                average: number | null;
                count: number;
                distribution: {
                    rating: number;
                    count: number;
                }[];
            };
            penalties: {
                id: string;
                amount: number;
                orderId: string | null;
                note: string | null;
                date: Date;
                settled: boolean;
            }[];
            lateDispatchPenalty: number;
            tips: string[];
        };
        products: {
            [k: string]: number;
        };
        lifetime: {
            orders: number;
            gmv: number;
        };
        payoutDue: {
            amount: number;
            settlements: number;
            ledgerAmount: number;
        };
        payouts: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            payoutNumber: string;
            sellerId: string;
            amount: number;
            settlementsAmount: number;
            ledgerAmount: number;
            settlementCount: number;
            ledgerCount: number;
            method: string;
            reference: string | null;
            note: string | null;
            bankSnapshot: Prisma.JsonValue | null;
            createdBy: string;
            createdAt: Date;
        }, unknown> & {})[];
        penalties: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            type: import(".prisma/client").SellerLedgerType;
            amount: number;
            referenceId: string | null;
            orderId: string | null;
            note: string | null;
            entryDate: Date;
            settledAt: Date | null;
            payoutId: string | null;
            waivedAt: Date | null;
            waivedBy: string | null;
            createdAt: Date;
        }, unknown> & {})[];
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
    }>;
    setCommission(sellerId: string, input: {
        commissionPct: number;
        platformFee: number;
    }): Promise<{
        id: string;
        sellerCode: string;
        email: string | null;
        phone: string | null;
        whatsapp: string | null;
        status: import(".prisma/client").UserStatus;
        statusReason: string | null;
        joinedAt: Date;
        store: {
            name: string;
            slug: string;
            description: string | null;
            supportEmail: string | null;
            supportPhone: string | null;
            vacationMode: boolean;
        } | null;
        kyc: {
            status: import(".prisma/client").KycStatus;
            rejectionReason: string | null;
            verifiedAt: Date | null;
            businessType: import(".prisma/client").BusinessType;
            gstRegistered: boolean;
            gstin: string | null;
            enrolmentId: string | null;
            pan: string | null;
            state: string;
            panMatchesGstin: boolean;
        } | null;
        pickup: {
            contactName: string | null;
            phone: string | null;
            line1: string | null;
            line2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
        } | null;
        bankAccounts: {
            id: string;
            bankName: string;
            holderName: string;
            accountNumberMasked: string;
            ifsc: string;
            isPrimary: boolean;
            holderMatchesStore: boolean;
        }[];
        payoutHold: boolean;
        payoutHoldReason: string | null;
        commission: {
            commissionPct: number;
            platformFee: number;
            custom: boolean;
        };
        health: {
            days: number;
            score: number;
            status: string;
            orders: number;
            overdueOrders: number;
            metrics: {
                key: string;
                label: string;
                value: number | null;
                unit: string;
                target: string;
                status: "GOOD" | "AT_RISK" | "POOR" | "NO_DATA";
            }[];
            ratings: {
                average: number | null;
                count: number;
                distribution: {
                    rating: number;
                    count: number;
                }[];
            };
            penalties: {
                id: string;
                amount: number;
                orderId: string | null;
                note: string | null;
                date: Date;
                settled: boolean;
            }[];
            lateDispatchPenalty: number;
            tips: string[];
        };
        products: {
            [k: string]: number;
        };
        lifetime: {
            orders: number;
            gmv: number;
        };
        payoutDue: {
            amount: number;
            settlements: number;
            ledgerAmount: number;
        };
        payouts: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            payoutNumber: string;
            sellerId: string;
            amount: number;
            settlementsAmount: number;
            ledgerAmount: number;
            settlementCount: number;
            ledgerCount: number;
            method: string;
            reference: string | null;
            note: string | null;
            bankSnapshot: Prisma.JsonValue | null;
            createdBy: string;
            createdAt: Date;
        }, unknown> & {})[];
        penalties: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            type: import(".prisma/client").SellerLedgerType;
            amount: number;
            referenceId: string | null;
            orderId: string | null;
            note: string | null;
            entryDate: Date;
            settledAt: Date | null;
            payoutId: string | null;
            waivedAt: Date | null;
            waivedBy: string | null;
            createdAt: Date;
        }, unknown> & {})[];
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
    }>;
}
export declare const adminSellersService: AdminSellersService;
export {};
//# sourceMappingURL=sellers.service.d.ts.map