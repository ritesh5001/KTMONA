/**
 * Support Service
 *
 * Buyer/seller <-> admin conversations. Tickets carry denormalized
 * `lastMessage*` and unread counters so an inbox renders from one indexed read
 * rather than aggregating messages per ticket, and every write publishes a live
 * event so open clients append without polling.
 */
import type { Prisma, Role, SupportTicketStatus } from '@prisma/client';
import type { CreateSupportTicketInput, SendSupportMessageInput, SupportMessageListQuery, SupportTicketListQuery, UpdateSupportTicketInput } from '../validators/support.validation.js';
export declare const isSupportAdmin: (role: Role) => boolean;
declare const ticketSelect: {
    id: true;
    requesterId: true;
    requesterRole: true;
    assigneeId: true;
    subject: true;
    category: true;
    status: true;
    orderId: true;
    lastMessageAt: true;
    lastMessagePreview: true;
    unreadForAdmin: true;
    unreadForRequester: true;
    closedAt: true;
    createdAt: true;
    requester: {
        select: {
            id: true;
            email: true;
            phone: true;
            role: true;
            user_profiles: {
                select: {
                    full_name: true;
                    avatar: true;
                };
            };
            seller_profiles: {
                select: {
                    store_name: true;
                };
            };
        };
    };
    assignee: {
        select: {
            id: true;
            email: true;
            phone: true;
            role: true;
            user_profiles: {
                select: {
                    full_name: true;
                    avatar: true;
                };
            };
            seller_profiles: {
                select: {
                    store_name: true;
                };
            };
        };
    };
};
type TicketRow = Prisma.SupportTicketGetPayload<{
    select: typeof ticketSelect;
}>;
declare const messageSelect: {
    id: true;
    ticketId: true;
    senderId: true;
    senderRole: true;
    body: true;
    attachments: true;
    createdAt: true;
    sender: {
        select: {
            id: true;
            email: true;
            phone: true;
            role: true;
            user_profiles: {
                select: {
                    full_name: true;
                    avatar: true;
                };
            };
            seller_profiles: {
                select: {
                    store_name: true;
                };
            };
        };
    };
};
type MessageRow = Prisma.SupportMessageGetPayload<{
    select: typeof messageSelect;
}>;
declare const toTicketResponse: (ticket: TicketRow, viewerIsAdmin: boolean) => {
    id: string;
    subject: string;
    category: import(".prisma/client").SupportTicketCategory;
    status: SupportTicketStatus;
    orderId: string | null;
    requesterRole: Role;
    requester: {
        id: string;
        role: Role;
        email: string | null;
        phone: string | null;
        name: string;
        avatar: string | null;
    } | null;
    assignee: {
        id: string;
        role: Role;
        email: string | null;
        phone: string | null;
        name: string;
        avatar: string | null;
    } | null;
    lastMessageAt: Date;
    lastMessagePreview: string | null;
    unreadCount: number;
    closedAt: Date | null;
    createdAt: Date;
};
declare const toMessageResponse: (message: MessageRow) => {
    id: string;
    ticketId: string;
    body: string;
    attachments: string[];
    senderId: string;
    senderRole: Role;
    sender: {
        id: string;
        role: Role;
        email: string | null;
        phone: string | null;
        name: string;
        avatar: string | null;
    } | null;
    createdAt: Date;
};
export type SupportTicketResponse = ReturnType<typeof toTicketResponse>;
export type SupportMessageResponse = ReturnType<typeof toMessageResponse>;
export declare class SupportService {
    /**
     * Everyone on a ticket: the requester plus every admin. Used as the live
     * event audience so both sides get the message on the same publish.
     */
    private audienceFor;
    private loadTicketForViewer;
    createTicket(requesterId: string, requesterRole: Role, input: CreateSupportTicketInput): Promise<{
        ticket: SupportTicketResponse;
        message: SupportMessageResponse;
    }>;
    listTickets(viewerId: string, viewerRole: Role, query: SupportTicketListQuery): Promise<{
        tickets: SupportTicketResponse[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getTicket(ticketId: string, viewerId: string, viewerRole: Role): Promise<SupportTicketResponse>;
    /**
     * Newest-last page of messages. `before` pages backwards through history.
     */
    listMessages(ticketId: string, viewerId: string, viewerRole: Role, query: SupportMessageListQuery): Promise<{
        messages: SupportMessageResponse[];
        hasMore: boolean;
    }>;
    sendMessage(ticketId: string, senderId: string, senderRole: Role, input: SendSupportMessageInput): Promise<{
        message: SupportMessageResponse;
        ticket: SupportTicketResponse;
    }>;
    /** Clear the viewer's own unread counter. */
    markRead(ticketId: string, viewerId: string, viewerRole: Role): Promise<{
        unreadCount: number;
    }>;
    updateTicket(ticketId: string, actorId: string, actorRole: Role, input: UpdateSupportTicketInput): Promise<SupportTicketResponse>;
    /** Badge count for the viewer's own side, in one indexed aggregate. */
    unreadSummary(viewerId: string, viewerRole: Role): Promise<{
        unreadTickets: number;
        unreadMessages: number;
    }>;
}
export declare const supportService: SupportService;
export {};
//# sourceMappingURL=support.service.d.ts.map