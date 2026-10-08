import * as React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";
import {
  SUPPORT_STATUS_LABELS,
  listSupportMessages,
  markSupportTicketRead,
  sendSupportMessage,
  type SupportMessage,
  type SupportTicket,
} from "../../src/services/support";
import { isAbortError } from "../../src/services/api";
import { useAuth } from "../../src/hooks/useAuth";
import { useToast } from "../../src/providers/ToastProvider";
import { AppHeader } from "../../src/components/AppHeader";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../src/components";

/**
 * React Native has no EventSource, so instead of the SSE stream the web app
 * uses, the thread refreshes on a short interval — but only while it is the
 * focused screen and the app is in the foreground.
 */
const POLL_INTERVAL_MS = 4000;

const formatTime = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

export default function SupportThreadScreen() {
  const params = useLocalSearchParams<{
    id: string;
    subject?: string;
    status?: string;
  }>();
  const ticketId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const token = session?.accessToken ?? null;
  const userId = session?.user?.id ?? null;
  const { showToast } = useToast();

  const [ticket, setTicket] = React.useState<SupportTicket | null>(null);
  const headerSubject =
    ticket?.subject ??
    (typeof params.subject === "string" ? params.subject : undefined) ??
    "Support";
  const headerStatus =
    ticket?.status ??
    ((typeof params.status === "string" ? params.status : undefined) as
      | SupportTicket["status"]
      | undefined);
  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const listRef = React.useRef<FlatList<SupportMessage>>(null);

  const scrollToEnd = React.useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const refresh = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!token || !ticketId) return;
      try {
        const next = await listSupportMessages(ticketId, token, signal);
        setMessages((prev) => {
          // Skip the state update when nothing changed so the poll does not
          // re-render the thread every few seconds.
          const latest = next[next.length - 1];
          const current = prev[prev.length - 1];
          if (prev.length === next.length && latest?.id === current?.id) {
            return prev;
          }
          return next;
        });
      } catch (err) {
        if (isAbortError(err)) return;
      }
    },
    [token, ticketId]
  );

  // Only the messages are fetched. The header comes from the params the inbox
  // already had, and clearing the unread badge is fire-and-forget — this used to
  // pull the entire ticket list for one subject line and then hold the spinner
  // through a third round trip nobody was waiting on.
  React.useEffect(() => {
    if (!token || !ticketId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    listSupportMessages(ticketId, token, controller.signal)
      .then((history) => {
        if (!active) return;
        setMessages(history);
        scrollToEnd();
      })
      .catch((err) => {
        if (isAbortError(err) || !active) return;
        showToast(
          err instanceof Error ? err.message : "Unable to load this conversation",
          "error"
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Nothing renders from this; it must never gate the screen.
    void markSupportTicketRead(ticketId, token).catch(() => undefined);

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, ticketId, scrollToEnd, showToast]);

  useFocusEffect(
    React.useCallback(() => {
      if (!token || !ticketId) return;

      const timer = setInterval(() => {
        if (AppState.currentState === "active") void refresh();
      }, POLL_INTERVAL_MS);

      return () => clearInterval(timer);
    }, [token, ticketId, refresh])
  );

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !ticketId || sending) return;

    setSending(true);
    setDraft("");
    try {
      const { message, ticket: updated } = await sendSupportMessage(
        ticketId,
        body,
        token
      );
      setMessages((prev) =>
        prev.some((existing) => existing.id === message.id) ? prev : [...prev, message]
      );
      setTicket(updated);
      scrollToEnd();
    } catch (err) {
      setDraft(body);
      showToast(
        err instanceof Error ? err.message : "Unable to send message",
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  const isClosed = headerStatus === "CLOSED";

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title={headerSubject} />

      {headerStatus ? (
        <Text style={styles.status}>{SUPPORT_STATUS_LABELS[headerStatus]}</Text>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollToEnd}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {loading ? "Loading…" : "No messages yet."}
            </Text>
          }
          renderItem={({ item }) => {
            const isMine = item.senderId === userId;
            return (
              <View
                style={[
                  styles.bubbleRow,
                  isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
                ]}
              >
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={styles.bubbleAuthor}>
                    {isMine ? "You" : item.sender?.name ?? "Support"}
                  </Text>
                  <Text style={styles.bubbleBody}>{item.body}</Text>
                  <Text style={styles.bubbleTime}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            );
          }}
        />

        {isClosed ? (
          <Text style={styles.closedNote}>
            This conversation is closed. Raise a new request to continue.
          </Text>
        ) : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={colors.brownSoft}
              multiline
              style={styles.composerInput}
            />
            <Pressable
              style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!draft.trim() || sending}
            >
              <Text style={styles.sendButtonText}>{sending ? "…" : "Send"}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  status: {
    color: colors.gold,
    fontFamily: typography.sansMedium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: { padding: spacing.lg, gap: spacing.md },
  emptyText: {
    color: colors.brownSoft,
    fontFamily: typography.sans,
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  bubbleRow: { flexDirection: "row" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowTheirs: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "82%",
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bubbleMine: { borderColor: colors.gold, backgroundColor: colors.cream },
  bubbleTheirs: {
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
  },
  bubbleAuthor: {
    color: colors.brownSoft,
    fontFamily: typography.sansMedium,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bubbleBody: { color: colors.foreground, fontFamily: typography.sans, fontSize: 14 },
  bubbleTime: { color: colors.brownSoft, fontFamily: typography.sans, fontSize: 10 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    padding: spacing.md,
  },
  composerInput: {
    borderRadius: radius.sm,
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    color: colors.foreground,
    fontFamily: typography.sans,
    fontSize: 14,
    padding: spacing.md,
  },
  sendButton: {
    borderRadius: radius.md,
    backgroundColor: colors.charcoal,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: {
    color: colors.warmWhite,
    fontFamily: typography.sansMedium,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  closedNote: {
    color: colors.brownSoft,
    fontFamily: typography.sans,
    fontSize: 13,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
});
