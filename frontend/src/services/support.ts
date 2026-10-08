import { apiRequest } from "@/services/api";

export type SupportTicketStatus =
    | "OPEN"
    | "AWAITING_CUSTOMER"
    | "RESOLVED"
    | "CLOSED";

export type SupportTicketCategory =
    | "ORDER"
    | "PAYMENT"
    | "PRODUCT"
    | "ACCOUNT"
    | "SETTLEMENT"
    | "OTHER";

export interface SupportParticipant {
    id: string;
    role: string;
    email?: string | null;
    phone?: string | null;
    name: string;
    avatar?: string | null;
}

export interface SupportTicket {
    id: string;
    subject: string;
    category: SupportTicketCategory;
    status: SupportTicketStatus;
    orderId?: string | null;
    requesterRole: string;
    requester: SupportParticipant | null;
    assignee: SupportParticipant | null;
    lastMessageAt: string;
    lastMessagePreview?: string | null;
    unreadCount: number;
    closedAt?: string | null;
    createdAt: string;
}

export interface SupportMessage {
    id: string;
    ticketId: string;
    body: string;
    attachments: string[];
    senderId: string;
    senderRole: string;
    sender: SupportParticipant | null;
    createdAt: string;
}

export interface SupportTicketListResponse {
    tickets: SupportTicket[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
    ORDER: "Order",
    PAYMENT: "Payment",
    PRODUCT: "Product",
    ACCOUNT: "Account",
    SETTLEMENT: "Settlement",
    OTHER: "Other",
};

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
    OPEN: "Open",
    AWAITING_CUSTOMER: "Awaiting reply",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
};

export async function listSupportTickets(
    query?: {
        status?: SupportTicketStatus;
        requesterRole?: "USER" | "SELLER";
        page?: number;
        limit?: number;
    },
    token?: string | null
): Promise<SupportTicketListResponse> {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    if (query?.requesterRole) params.set("requesterRole", query.requesterRole);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();

    return apiRequest<SupportTicketListResponse>(
        `/v1/support/tickets${qs ? `?${qs}` : ""}`,
        { method: "GET", token }
    );
}

export async function createSupportTicket(
    payload: {
        subject: string;
        category?: SupportTicketCategory;
        orderId?: string | null;
        message: string;
        attachments?: string[];
    },
    token?: string | null
): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
    return apiRequest<{ ticket: SupportTicket; message: SupportMessage }>(
        "/v1/support/tickets",
        { method: "POST", body: payload, token }
    );
}

export async function listSupportMessages(
    ticketId: string,
    query?: { before?: string; limit?: number },
    token?: string | null
): Promise<{ messages: SupportMessage[]; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (query?.before) params.set("before", query.before);
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();

    return apiRequest<{ messages: SupportMessage[]; hasMore: boolean }>(
        `/v1/support/tickets/${ticketId}/messages${qs ? `?${qs}` : ""}`,
        { method: "GET", token }
    );
}

export async function sendSupportMessage(
    ticketId: string,
    payload: { body: string; attachments?: string[] },
    token?: string | null
): Promise<{ message: SupportMessage; ticket: SupportTicket }> {
    return apiRequest<{ message: SupportMessage; ticket: SupportTicket }>(
        `/v1/support/tickets/${ticketId}/messages`,
        { method: "POST", body: payload, token }
    );
}

export async function markSupportTicketRead(
    ticketId: string,
    token?: string | null
): Promise<{ unreadCount: number }> {
    return apiRequest<{ unreadCount: number }>(
        `/v1/support/tickets/${ticketId}/read`,
        { method: "POST", token }
    );
}

export async function updateSupportTicket(
    ticketId: string,
    payload: { status?: SupportTicketStatus; assigneeId?: string | null },
    token?: string | null
): Promise<{ ticket: SupportTicket }> {
    return apiRequest<{ ticket: SupportTicket }>(
        `/v1/support/tickets/${ticketId}`,
        { method: "PATCH", body: payload, token }
    );
}

export async function getSupportUnreadSummary(
    token?: string | null
): Promise<{ unreadTickets: number; unreadMessages: number }> {
    return apiRequest<{ unreadTickets: number; unreadMessages: number }>(
        "/v1/support/unread",
        { method: "GET", token }
    );
}
