/**
 * Support Service
 *
 * Buyer/seller <-> admin conversations. Tickets carry denormalized
 * `lastMessage*` and unread counters so an inbox renders from one indexed read
 * rather than aggregating messages per ticket, and every write publishes a live
 * event so open clients append without polling.
 */

import type { Prisma, Role, SupportTicketStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { publishLiveDashboardEvent, type LiveEventAudience } from '../live/live-events.js';
import type {
    CreateSupportTicketInput,
    SendSupportMessageInput,
    SupportMessageListQuery,
    SupportTicketListQuery,
    UpdateSupportTicketInput,
} from '../validators/support.validation.js';

const ADMIN_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN'];
const DEFAULT_TICKET_LIMIT = 20;
const DEFAULT_MESSAGE_LIMIT = 50;
const PREVIEW_LENGTH = 140;

export const isSupportAdmin = (role: Role): boolean => ADMIN_ROLES.includes(role);

const toPreview = (body: string): string =>
    body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH - 1)}…` : body;

const participantSelect = {
    id: true,
    email: true,
    phone: true,
    role: true,
    user_profiles: { select: { full_name: true, avatar: true } },
    seller_profiles: { select: { store_name: true } },
} satisfies Prisma.UserSelect;

type ParticipantRow = Prisma.UserGetPayload<{ select: typeof participantSelect }>;

const toParticipant = (user: ParticipantRow | null | undefined) => {
    if (!user) return null;
    return {
        id: user.id,
        role: user.role,
        email: user.email,
        phone: user.phone,
        name:
            user.seller_profiles?.store_name ??
            user.user_profiles?.full_name ??
            user.email ??
            user.phone ??
            'Unknown',
        avatar: user.user_profiles?.avatar ?? null,
    };
};

const ticketSelect = {
    id: true,
    requesterId: true,
    requesterRole: true,
    assigneeId: true,
    subject: true,
    category: true,
    status: true,
    orderId: true,
    lastMessageAt: true,
    lastMessagePreview: true,
    unreadForAdmin: true,
    unreadForRequester: true,
    closedAt: true,
    createdAt: true,
    requester: { select: participantSelect },
    assignee: { select: participantSelect },
} satisfies Prisma.SupportTicketSelect;

type TicketRow = Prisma.SupportTicketGetPayload<{ select: typeof ticketSelect }>;

const messageSelect = {
    id: true,
    ticketId: true,
    senderId: true,
    senderRole: true,
    body: true,
    attachments: true,
    createdAt: true,
    sender: { select: participantSelect },
} satisfies Prisma.SupportMessageSelect;

type MessageRow = Prisma.SupportMessageGetPayload<{ select: typeof messageSelect }>;

const toTicketResponse = (ticket: TicketRow, viewerIsAdmin: boolean) => ({
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    orderId: ticket.orderId,
    requesterRole: ticket.requesterRole,
    requester: toParticipant(ticket.requester),
    assignee: toParticipant(ticket.assignee),
    lastMessageAt: ticket.lastMessageAt,
    lastMessagePreview: ticket.lastMessagePreview,
    // Each side only ever needs its own count; exposing both invites a client
    // rendering the wrong badge.
    unreadCount: viewerIsAdmin ? ticket.unreadForAdmin : ticket.unreadForRequester,
    closedAt: ticket.closedAt,
    createdAt: ticket.createdAt,
});

const toMessageResponse = (message: MessageRow) => ({
    id: message.id,
    ticketId: message.ticketId,
    body: message.body,
    attachments: message.attachments,
    senderId: message.senderId,
    senderRole: message.senderRole,
    sender: toParticipant(message.sender),
    createdAt: message.createdAt,
});

export type SupportTicketResponse = ReturnType<typeof toTicketResponse>;
export type SupportMessageResponse = ReturnType<typeof toMessageResponse>;

export class SupportService {
    /**
     * Everyone on a ticket: the requester plus every admin. Used as the live
     * event audience so both sides get the message on the same publish.
     */
    private audienceFor(ticket: { requesterId: string }): LiveEventAudience {
        return { userIds: [ticket.requesterId], roles: ADMIN_ROLES };
    }

    private async loadTicketForViewer(
        ticketId: string,
        viewerId: string,
        viewerRole: Role,
    ): Promise<TicketRow> {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            select: ticketSelect,
        });

        if (!ticket) {
            throw ApiError.notFound('Support ticket not found');
        }

        if (!isSupportAdmin(viewerRole) && ticket.requesterId !== viewerId) {
            // Same status as a missing ticket — a stranger should not be able to
            // probe which ticket ids exist.
            throw ApiError.notFound('Support ticket not found');
        }

        return ticket;
    }

    async createTicket(
        requesterId: string,
        requesterRole: Role,
        input: CreateSupportTicketInput,
    ): Promise<{ ticket: SupportTicketResponse; message: SupportMessageResponse }> {
        if (isSupportAdmin(requesterRole)) {
            throw ApiError.badRequest('Admins reply to tickets rather than raising them');
        }

        const now = new Date();
        const ticket = await prisma.supportTicket.create({
            data: {
                requesterId,
                requesterRole,
                subject: input.subject,
                category: input.category ?? 'OTHER',
                orderId: input.orderId ?? null,
                lastMessageAt: now,
                lastMessagePreview: toPreview(input.message),
                unreadForAdmin: 1,
                messages: {
                    create: {
                        senderId: requesterId,
                        senderRole: requesterRole,
                        body: input.message,
                        attachments: input.attachments ?? [],
                        createdAt: now,
                    },
                },
            },
            select: { ...ticketSelect, messages: { select: messageSelect } },
        });

        const firstMessage = ticket.messages[0]!;
        const ticketResponse = toTicketResponse(ticket, false);
        const messageResponse = toMessageResponse(firstMessage);

        void publishLiveDashboardEvent({
            type: 'support.message',
            entityId: ticket.id,
            tags: ['support'],
            payload: { ticketId: ticket.id, message: messageResponse },
            audience: this.audienceFor(ticket),
        });

        return { ticket: ticketResponse, message: messageResponse };
    }

    async listTickets(
        viewerId: string,
        viewerRole: Role,
        query: SupportTicketListQuery,
    ): Promise<{
        tickets: SupportTicketResponse[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
    }> {
        const viewerIsAdmin = isSupportAdmin(viewerRole);
        const page = query.page ?? 1;
        const limit = query.limit ?? DEFAULT_TICKET_LIMIT;

        const where: Prisma.SupportTicketWhereInput = {
            ...(viewerIsAdmin ? {} : { requesterId: viewerId }),
            ...(query.status ? { status: query.status } : {}),
            ...(viewerIsAdmin && query.requesterRole
                ? { requesterRole: query.requesterRole }
                : {}),
        };

        const [tickets, total] = await Promise.all([
            prisma.supportTicket.findMany({
                where,
                orderBy: { lastMessageAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: ticketSelect,
            }),
            prisma.supportTicket.count({ where }),
        ]);

        return {
            tickets: tickets.map((ticket) => toTicketResponse(ticket, viewerIsAdmin)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }

    async getTicket(
        ticketId: string,
        viewerId: string,
        viewerRole: Role,
    ): Promise<SupportTicketResponse> {
        const ticket = await this.loadTicketForViewer(ticketId, viewerId, viewerRole);
        return toTicketResponse(ticket, isSupportAdmin(viewerRole));
    }

    /**
     * Newest-last page of messages. `before` pages backwards through history.
     */
    async listMessages(
        ticketId: string,
        viewerId: string,
        viewerRole: Role,
        query: SupportMessageListQuery,
    ): Promise<{ messages: SupportMessageResponse[]; hasMore: boolean }> {
        const ticket = await this.loadTicketForViewer(ticketId, viewerId, viewerRole);
        const limit = query.limit ?? DEFAULT_MESSAGE_LIMIT;

        const rows = await prisma.supportMessage.findMany({
            where: { ticketId: ticket.id },
            orderBy: { createdAt: 'desc' },
            take: limit + 1,
            ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
            select: messageSelect,
        });

        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;

        return {
            messages: page.reverse().map(toMessageResponse),
            hasMore,
        };
    }

    async sendMessage(
        ticketId: string,
        senderId: string,
        senderRole: Role,
        input: SendSupportMessageInput,
    ): Promise<{ message: SupportMessageResponse; ticket: SupportTicketResponse }> {
        const ticket = await this.loadTicketForViewer(ticketId, senderId, senderRole);

        if (ticket.status === 'CLOSED') {
            throw ApiError.badRequest('This ticket is closed. Raise a new one to continue.');
        }

        const senderIsAdmin = isSupportAdmin(senderRole);
        const now = new Date();

        // One transaction: the message and the counters the inbox reads must not
        // be observable apart.
        const [message, updatedTicket] = await prisma.$transaction([
            prisma.supportMessage.create({
                data: {
                    ticketId: ticket.id,
                    senderId,
                    senderRole,
                    body: input.body,
                    attachments: input.attachments ?? [],
                    createdAt: now,
                },
                select: messageSelect,
            }),
            prisma.supportTicket.update({
                where: { id: ticket.id },
                data: {
                    lastMessageAt: now,
                    lastMessagePreview: toPreview(input.body),
                    // An admin reply puts the ball in the customer's court, and a
                    // customer reply reopens a resolved ticket.
                    status: senderIsAdmin ? 'AWAITING_CUSTOMER' : 'OPEN',
                    ...(senderIsAdmin
                        ? { unreadForRequester: { increment: 1 }, unreadForAdmin: 0 }
                        : { unreadForAdmin: { increment: 1 }, unreadForRequester: 0 }),
                },
                select: ticketSelect,
            }),
        ]);

        const messageResponse = toMessageResponse(message);

        void publishLiveDashboardEvent({
            type: 'support.message',
            entityId: ticket.id,
            tags: ['support'],
            payload: { ticketId: ticket.id, message: messageResponse },
            audience: this.audienceFor(ticket),
        });

        return {
            message: messageResponse,
            ticket: toTicketResponse(updatedTicket, senderIsAdmin),
        };
    }

    /** Clear the viewer's own unread counter. */
    async markRead(
        ticketId: string,
        viewerId: string,
        viewerRole: Role,
    ): Promise<{ unreadCount: number }> {
        const ticket = await this.loadTicketForViewer(ticketId, viewerId, viewerRole);
        const viewerIsAdmin = isSupportAdmin(viewerRole);

        await prisma.supportTicket.update({
            where: { id: ticket.id },
            data: viewerIsAdmin ? { unreadForAdmin: 0 } : { unreadForRequester: 0 },
        });

        return { unreadCount: 0 };
    }

    async updateTicket(
        ticketId: string,
        actorId: string,
        actorRole: Role,
        input: UpdateSupportTicketInput,
    ): Promise<SupportTicketResponse> {
        if (!isSupportAdmin(actorRole)) {
            throw ApiError.forbidden('Only admins can update ticket status');
        }

        const ticket = await this.loadTicketForViewer(ticketId, actorId, actorRole);
        const nextStatus = input.status as SupportTicketStatus | undefined;

        const updated = await prisma.supportTicket.update({
            where: { id: ticket.id },
            data: {
                ...(nextStatus ? { status: nextStatus } : {}),
                ...(nextStatus
                    ? { closedAt: nextStatus === 'CLOSED' ? new Date() : null }
                    : {}),
                ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
            },
            select: ticketSelect,
        });

        const response = toTicketResponse(updated, true);

        void publishLiveDashboardEvent({
            type: 'support.ticket.updated',
            entityId: ticket.id,
            tags: ['support'],
            payload: { ticketId: ticket.id, status: updated.status },
            audience: this.audienceFor(ticket),
        });

        return response;
    }

    /** Badge count for the viewer's own side, in one indexed aggregate. */
    async unreadSummary(
        viewerId: string,
        viewerRole: Role,
    ): Promise<{ unreadTickets: number; unreadMessages: number }> {
        const viewerIsAdmin = isSupportAdmin(viewerRole);
        const where: Prisma.SupportTicketWhereInput = viewerIsAdmin
            ? { unreadForAdmin: { gt: 0 } }
            : { requesterId: viewerId, unreadForRequester: { gt: 0 } };

        const [unreadTickets, aggregate] = await Promise.all([
            prisma.supportTicket.count({ where }),
            prisma.supportTicket.aggregate({
                where,
                _sum: { unreadForAdmin: true, unreadForRequester: true },
            }),
        ]);

        return {
            unreadTickets,
            unreadMessages:
                (viewerIsAdmin
                    ? aggregate._sum.unreadForAdmin
                    : aggregate._sum.unreadForRequester) ?? 0,
        };
    }
}

export const supportService = new SupportService();
