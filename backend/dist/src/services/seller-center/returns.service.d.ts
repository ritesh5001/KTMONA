/**
 * Seller returns & RTO, and claims for bad returns / lost RTO / payment issues.
 */
import { ReturnStatus, SellerClaimStatus, SellerClaimType } from '@prisma/client';
export declare const RETURN_TABS: readonly ["all", "requested", "approved", "inspecting", "refunded", "rejected"];
export type ReturnTab = (typeof RETURN_TABS)[number];
declare class SellerReturnsService {
    listReturns(sellerId: string, query: Record<string, unknown>): Promise<{
        tab: "all" | "rejected" | "requested" | "approved" | "inspecting" | "refunded";
        counts: Record<string, number>;
        returns: {
            id: string;
            orderId: string;
            status: ReturnStatus;
            reason: string;
            rejectionReason: string | null;
            requestedAt: Date;
            reviewedAt: Date | null;
            items: {
                title: string;
                image: string | null;
                size: string | undefined;
                color: string | null | undefined;
                sku: string | undefined;
                quantity: number;
                reason: string | null;
                amount: number;
            }[];
            sellerAmount: number;
            claim: {
                returnId: string | null;
                claimNumber: string;
                status: SellerClaimStatus;
            } | null;
            canClaim: boolean;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    listRto(sellerId: string, query: Record<string, unknown>): Promise<{
        counts: {
            all: number;
            in_transit: number;
            received: number;
        };
        rto: {
            orderId: string;
            status: import(".prisma/client").ShipmentStatus;
            awb: string | null;
            carrier: string;
            reason: string | null;
            initiatedAt: Date | null;
            receivedAt: Date | null;
            customer: {
                name: string | null;
                city: string | null;
            };
            units: number;
            sellerAmount: number;
            claim: {
                orderId: string;
                claimNumber: string;
                status: SellerClaimStatus;
            } | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    listClaims(sellerId: string, query: Record<string, unknown>): Promise<{
        counts: Record<string, number>;
        claims: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            claimNumber: string;
            sellerId: string;
            orderId: string;
            returnId: string | null;
            type: SellerClaimType;
            description: string;
            images: string[];
            amountClaimed: number | null;
            status: SellerClaimStatus;
            amountApproved: number | null;
            resolutionNote: string | null;
            reviewedBy: string | null;
            reviewedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {})[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    createClaim(sellerId: string, input: {
        orderId: string;
        returnId?: string | undefined;
        type: SellerClaimType;
        description: string;
        images?: string[] | undefined;
        amountClaimed?: number | undefined;
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        claimNumber: string;
        sellerId: string;
        orderId: string;
        returnId: string | null;
        type: SellerClaimType;
        description: string;
        images: string[];
        amountClaimed: number | null;
        status: SellerClaimStatus;
        amountApproved: number | null;
        resolutionNote: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    adminList(query: Record<string, unknown>): Promise<{
        claims: {
            storeName: string | null;
            status: SellerClaimStatus;
            type: SellerClaimType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            reviewedBy: string | null;
            reviewedAt: Date | null;
            sellerId: string;
            description: string;
            images: string[];
            orderId: string;
            claimNumber: string;
            returnId: string | null;
            amountClaimed: number | null;
            amountApproved: number | null;
            resolutionNote: string | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    adminReview(adminId: string, claimId: string, input: {
        status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
        amountApproved?: number | undefined;
        note?: string | undefined;
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        claimNumber: string;
        sellerId: string;
        orderId: string;
        returnId: string | null;
        type: SellerClaimType;
        description: string;
        images: string[];
        amountClaimed: number | null;
        status: SellerClaimStatus;
        amountApproved: number | null;
        resolutionNote: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
}
export declare const sellerReturnsService: SellerReturnsService;
export {};
//# sourceMappingURL=returns.service.d.ts.map