"use client";

import * as React from "react";
import { Send, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useLiveFreshness } from "@/hooks/use-live-freshness";
import {
    SUPPORT_CATEGORY_LABELS,
    SUPPORT_STATUS_LABELS,
    createSupportTicket,
    listSupportMessages,
    listSupportTickets,
    markSupportTicketRead,
    sendSupportMessage,
    updateSupportTicket,
    type SupportMessage,
    type SupportTicket,
    type SupportTicketCategory,
    type SupportTicketStatus,
} from "@/services/support";

type Audience = "requester" | "admin";

const CATEGORIES = Object.keys(SUPPORT_CATEGORY_LABELS) as SupportTicketCategory[];
const ADMIN_STATUSES: SupportTicketStatus[] = [
    "OPEN",
    "AWAITING_CUSTOMER",
    "RESOLVED",
    "CLOSED",
];

const statusStyle = (status: SupportTicketStatus) => {
    switch (status) {
        case "OPEN":
            return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
        case "AWAITING_CUSTOMER":
            return "border-brand/30 text-brand-strong bg-brand/5";
        case "RESOLVED":
            return "border-border-soft text-muted-foreground bg-mist/30";
        default:
            return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    }
};

const formatTime = (value: string) =>
    new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });

export default function SupportChat({
    audience,
    title,
    description,
}: {
    audience: Audience;
    title: string;
    description: string;
}) {
    const { user, token, loading: authLoading } = useAuth();

    const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [messages, setMessages] = React.useState<SupportMessage[]>([]);
    const [isLoadingTickets, setIsLoadingTickets] = React.useState(true);
    const [isLoadingThread, setIsLoadingThread] = React.useState(false);
    const [draft, setDraft] = React.useState("");
    const [isSending, setIsSending] = React.useState(false);

    const [showNewTicket, setShowNewTicket] = React.useState(false);
    const [newSubject, setNewSubject] = React.useState("");
    const [newCategory, setNewCategory] = React.useState<SupportTicketCategory>("OTHER");
    const [newMessage, setNewMessage] = React.useState("");
    const [isCreating, setIsCreating] = React.useState(false);

    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const activeIdRef = React.useRef<string | null>(null);
    activeIdRef.current = activeId;

    const scrollToBottom = React.useCallback(() => {
        const node = scrollRef.current;
        if (node) node.scrollTop = node.scrollHeight;
    }, []);

    const loadTickets = React.useCallback(async () => {
        if (!token) return;
        try {
            const data = await listSupportTickets(undefined, token);
            setTickets(data.tickets);
            setActiveId((current) => current ?? data.tickets[0]?.id ?? null);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Unable to load conversations"
            );
        } finally {
            setIsLoadingTickets(false);
        }
    }, [token]);

    React.useEffect(() => {
        if (authLoading) return;
        if (!token) {
            setIsLoadingTickets(false);
            return;
        }
        void loadTickets();
    }, [authLoading, token, loadTickets]);

    // Thread history for the selected ticket.
    React.useEffect(() => {
        if (!token || !activeId) {
            setMessages([]);
            return;
        }

        let active = true;
        setIsLoadingThread(true);

        (async () => {
            try {
                const data = await listSupportMessages(activeId, undefined, token);
                if (!active) return;
                setMessages(data.messages);
                requestAnimationFrame(scrollToBottom);

                // Clear our own badge, and mirror it locally so the list updates
                // without waiting on a refetch.
                await markSupportTicketRead(activeId, token);
                if (!active) return;
                setTickets((prev) =>
                    prev.map((ticket) =>
                        ticket.id === activeId ? { ...ticket, unreadCount: 0 } : ticket
                    )
                );
            } catch (error) {
                if (!active) return;
                toast.error(
                    error instanceof Error ? error.message : "Unable to load messages"
                );
            } finally {
                if (active) setIsLoadingThread(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [token, activeId, scrollToBottom]);

    // Live delivery — the whole point of the SSE stream is that neither side polls.
    useLiveFreshness({
        enabled: Boolean(token),
        eventTypes: ["support.message", "support.ticket.updated"],
        onEvent: (event) => {
            const payload = event.payload as
                | { ticketId?: string; message?: SupportMessage; status?: SupportTicketStatus }
                | undefined;
            const ticketId = payload?.ticketId;
            if (!ticketId) return;

            if (event.type === "support.ticket.updated" && payload?.status) {
                setTickets((prev) =>
                    prev.map((ticket) =>
                        ticket.id === ticketId
                            ? { ...ticket, status: payload.status! }
                            : ticket
                    )
                );
                return;
            }

            const message = payload?.message;
            if (!message) return;

            if (ticketId === activeIdRef.current) {
                setMessages((prev) =>
                    prev.some((existing) => existing.id === message.id)
                        ? prev
                        : [...prev, message]
                );
                requestAnimationFrame(scrollToBottom);
                if (token) void markSupportTicketRead(ticketId, token);
            }

            setTickets((prev) => {
                const index = prev.findIndex((ticket) => ticket.id === ticketId);
                if (index === -1) {
                    // A ticket we have not loaded yet (a new one, for admins).
                    void loadTickets();
                    return prev;
                }

                const isOwnMessage = message.senderId === user?.id;
                const updated: SupportTicket = {
                    ...prev[index],
                    lastMessageAt: message.createdAt,
                    lastMessagePreview: message.body,
                    unreadCount:
                        ticketId === activeIdRef.current || isOwnMessage
                            ? 0
                            : prev[index].unreadCount + 1,
                };

                // Newest conversation first, same as the server ordering.
                return [updated, ...prev.filter((_, i) => i !== index)];
            });
        },
    });

    const activeTicket = tickets.find((ticket) => ticket.id === activeId) ?? null;

    const handleSend = async (event: React.FormEvent) => {
        event.preventDefault();
        const body = draft.trim();
        if (!body || !activeId || !token || isSending) return;

        setIsSending(true);
        setDraft("");
        try {
            const { message, ticket } = await sendSupportMessage(
                activeId,
                { body },
                token
            );

            setMessages((prev) =>
                prev.some((existing) => existing.id === message.id)
                    ? prev
                    : [...prev, message]
            );
            setTickets((prev) =>
                prev.map((existing) =>
                    existing.id === ticket.id ? { ...existing, ...ticket } : existing
                )
            );
            requestAnimationFrame(scrollToBottom);
        } catch (error) {
            setDraft(body);
            toast.error(
                error instanceof Error ? error.message : "Unable to send message"
            );
        } finally {
            setIsSending(false);
        }
    };

    const handleCreateTicket = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token) return;
        if (!newSubject.trim() || !newMessage.trim()) {
            toast.error("Add a subject and a message.");
            return;
        }

        setIsCreating(true);
        try {
            const { ticket } = await createSupportTicket(
                {
                    subject: newSubject.trim(),
                    category: newCategory,
                    message: newMessage.trim(),
                },
                token
            );

            setTickets((prev) => [ticket, ...prev]);
            setActiveId(ticket.id);
            setShowNewTicket(false);
            setNewSubject("");
            setNewMessage("");
            setNewCategory("OTHER");
            toast.success("Support request raised.");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Unable to raise the request"
            );
        } finally {
            setIsCreating(false);
        }
    };

    const handleStatusChange = async (status: SupportTicketStatus) => {
        if (!activeId || !token) return;
        try {
            const { ticket } = await updateSupportTicket(activeId, { status }, token);
            setTickets((prev) =>
                prev.map((existing) =>
                    existing.id === ticket.id ? { ...existing, ...ticket } : existing
                )
            );
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Unable to update the ticket"
            );
        }
    };

    if (!authLoading && !token) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-20 text-center">
                <h1 className="font-serif text-3xl font-light text-foreground">{title}</h1>
                <p className="mt-4 text-sm text-muted-foreground">
                    Please <a href="/login" className="underline text-primary">log in</a> to
                    view your support conversations.
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 lg:py-16">
            <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
                    Support
                </p>
                <h1 className="font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
                    {title}
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {description}
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                {/* Conversation list */}
                <div className="flex flex-col border border-border-soft bg-card">
                    <div className="flex items-center justify-between border-b border-border-soft p-4">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Conversations
                        </p>
                        {audience === "requester" && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => setShowNewTicket(true)}
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" /> New
                            </Button>
                        )}
                    </div>

                    <div className="max-h-[28rem] overflow-y-auto lg:max-h-[34rem]">
                        {isLoadingTickets ? (
                            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
                        ) : tickets.length === 0 ? (
                            <p className="p-6 text-sm text-muted-foreground">
                                {audience === "admin"
                                    ? "No support requests yet."
                                    : "No conversations yet. Raise one to get help."}
                            </p>
                        ) : (
                            tickets.map((ticket) => (
                                <button
                                    key={ticket.id}
                                    type="button"
                                    onClick={() => setActiveId(ticket.id)}
                                    className={`flex w-full flex-col gap-1.5 border-b border-border-soft p-4 text-left transition-colors ${
                                        ticket.id === activeId
                                            ? "bg-mist/50 dark:bg-navy/10"
                                            : "hover:bg-mist/30 dark:hover:bg-navy/5"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-sm font-medium text-foreground line-clamp-1">
                                            {ticket.subject}
                                        </span>
                                        {ticket.unreadCount > 0 && (
                                            <span className="min-w-5 rounded-full bg-brand px-1.5 py-0.5 text-center text-[10px] font-semibold text-ink">
                                                {ticket.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    {audience === "admin" && ticket.requester && (
                                        <span className="text-[11px] text-muted-foreground">
                                            {ticket.requester.name} · {ticket.requesterRole}
                                        </span>
                                    )}
                                    <span className="text-xs text-muted-foreground line-clamp-1">
                                        {ticket.lastMessagePreview ?? "No messages yet"}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${statusStyle(ticket.status)}`}
                                        >
                                            {SUPPORT_STATUS_LABELS[ticket.status]}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatTime(ticket.lastMessageAt)}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Thread */}
                <div className="flex min-h-[28rem] flex-col border border-border-soft bg-card lg:min-h-[34rem]">
                    {!activeTicket ? (
                        <div className="flex flex-1 items-center justify-center p-8">
                            <p className="text-sm text-muted-foreground">
                                Select a conversation to read it.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-soft p-4">
                                <div className="space-y-1">
                                    <p className="font-serif text-lg font-light text-foreground">
                                        {activeTicket.subject}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {SUPPORT_CATEGORY_LABELS[activeTicket.category]}
                                        {activeTicket.orderId
                                            ? ` · Order ${activeTicket.orderId}`
                                            : ""}
                                        {audience === "admin" && activeTicket.requester
                                            ? ` · ${activeTicket.requester.name}`
                                            : ""}
                                    </p>
                                </div>
                                {audience === "admin" ? (
                                    <select
                                        value={activeTicket.status}
                                        onChange={(event) =>
                                            handleStatusChange(
                                                event.target.value as SupportTicketStatus
                                            )
                                        }
                                        className="h-9 border border-border-soft bg-card px-3 text-sm text-foreground"
                                    >
                                        {ADMIN_STATUSES.map((status) => (
                                            <option key={status} value={status}>
                                                {SUPPORT_STATUS_LABELS[status]}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <span
                                        className={`border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider ${statusStyle(activeTicket.status)}`}
                                    >
                                        {SUPPORT_STATUS_LABELS[activeTicket.status]}
                                    </span>
                                )}
                            </div>

                            <div
                                ref={scrollRef}
                                className="flex-1 space-y-4 overflow-y-auto p-4"
                            >
                                {isLoadingThread ? (
                                    <p className="text-sm text-muted-foreground">
                                        Loading messages…
                                    </p>
                                ) : messages.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No messages yet.
                                    </p>
                                ) : (
                                    messages.map((message) => {
                                        const isMine = message.senderId === user?.id;
                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] space-y-1 border px-3 py-2 ${
                                                        isMine
                                                            ? "border-brand/30 bg-brand/5"
                                                            : "border-border-soft bg-mist/30 dark:bg-navy/10"
                                                    }`}
                                                >
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                                        {isMine
                                                            ? "You"
                                                            : message.sender?.name ?? "Support"}
                                                    </p>
                                                    <p className="whitespace-pre-wrap text-sm text-foreground">
                                                        {message.body}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {formatTime(message.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {activeTicket.status === "CLOSED" ? (
                                <p className="border-t border-border-soft p-4 text-sm text-muted-foreground">
                                    This conversation is closed.
                                    {audience === "requester"
                                        ? " Raise a new request to continue."
                                        : ""}
                                </p>
                            ) : (
                                <form
                                    onSubmit={handleSend}
                                    className="flex items-end gap-2 border-t border-border-soft p-4"
                                >
                                    <Textarea
                                        value={draft}
                                        onChange={(event) => setDraft(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" && !event.shiftKey) {
                                                event.preventDefault();
                                                void handleSend(event);
                                            }
                                        }}
                                        placeholder="Write a message… (Enter to send)"
                                        rows={2}
                                        className="flex-1 resize-none"
                                    />
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={isSending || !draft.trim()}
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>

            {showNewTicket && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
                    onClick={() => setShowNewTicket(false)}
                >
                    <form
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={handleCreateTicket}
                        className="w-full max-w-lg space-y-5 border border-border-soft bg-card p-6"
                    >
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                                    New Request
                                </p>
                                <h2 className="font-serif text-2xl font-light text-foreground">
                                    How can we help?
                                </h2>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowNewTicket(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Subject
                            <Input
                                value={newSubject}
                                onChange={(event) => setNewSubject(event.target.value)}
                                placeholder="Briefly, what is this about?"
                            />
                        </label>

                        <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Category
                            <select
                                value={newCategory}
                                onChange={(event) =>
                                    setNewCategory(event.target.value as SupportTicketCategory)
                                }
                                className="border border-border-soft bg-card px-3 py-2 text-sm text-foreground"
                            >
                                {CATEGORIES.map((category) => (
                                    <option key={category} value={category}>
                                        {SUPPORT_CATEGORY_LABELS[category]}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Message
                            <Textarea
                                value={newMessage}
                                onChange={(event) => setNewMessage(event.target.value)}
                                rows={5}
                                placeholder="Tell us what happened…"
                            />
                        </label>

                        <div className="flex gap-3">
                            <Button type="submit" size="sm" disabled={isCreating}>
                                {isCreating ? "Sending…" : "Raise Request"}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowNewTicket(false)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
