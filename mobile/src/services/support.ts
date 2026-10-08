import { apiRequest } from "./api";

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
  token?: string | null,
  signal?: AbortSignal
): Promise<SupportTicket[]> {
  const response = await apiRequest<{ tickets: SupportTicket[] }>(
    "/v1/support/tickets",
    { method: "GET", token, signal }
  );
  return response.tickets ?? [];
}

export async function createSupportTicket(
  payload: {
    subject: string;
    category?: SupportTicketCategory;
    orderId?: string | null;
    message: string;
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
  token?: string | null,
  signal?: AbortSignal
): Promise<SupportMessage[]> {
  const response = await apiRequest<{ messages: SupportMessage[] }>(
    `/v1/support/tickets/${ticketId}/messages`,
    { method: "GET", token, signal }
  );
  return response.messages ?? [];
}

export async function sendSupportMessage(
  ticketId: string,
  body: string,
  token?: string | null
): Promise<{ message: SupportMessage; ticket: SupportTicket }> {
  return apiRequest<{ message: SupportMessage; ticket: SupportTicket }>(
    `/v1/support/tickets/${ticketId}/messages`,
    { method: "POST", body: { body }, token, _skipDedup: true }
  );
}

export async function markSupportTicketRead(
  ticketId: string,
  token?: string | null
): Promise<void> {
  await apiRequest(`/v1/support/tickets/${ticketId}/read`, {
    method: "POST",
    token,
  });
}
