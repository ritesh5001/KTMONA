import * as React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../../src/components/Icon";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  createSupportTicket,
  listSupportTickets,
  type SupportTicket,
  type SupportTicketCategory,
} from "../../src/services/support";
import { isAbortError } from "../../src/services/api";
import { listBuyerOrders, type BuyerOrder } from "../../src/services/orders";
import { Image } from "../../src/components/CompatImage";
import { useAuth } from "../../src/hooks/useAuth";
import { useToast } from "../../src/providers/ToastProvider";
import { AppHeader } from "../../src/components/AppHeader";
import { getBottomBarTotalHeight } from "../../src/components/GlobalBottomBar";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../src/components";

const CATEGORIES = Object.keys(
  SUPPORT_CATEGORY_LABELS
) as SupportTicketCategory[];

const formatTime = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

export default function SupportInboxScreen() {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.accessToken ?? null;
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  // The bar is absolutely positioned over the screen, so nothing below this
  // offset is reachable — the New request button was sitting underneath it.
  const bottomBarHeight = getBottomBarTotalHeight(insets.bottom);

  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [composerOpen, setComposerOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [category, setCategory] = React.useState<SupportTicketCategory>("OTHER");
  const [message, setMessage] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [recentOrders, setRecentOrders] = React.useState<BuyerOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await listSupportTickets(token, signal);
        setTickets(data);
      } catch (err) {
        if (isAbortError(err)) return;
        showToast(
          err instanceof Error ? err.message : "Unable to load conversations",
          "error"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, showToast]
  );

  React.useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [authLoading, load]);

  // Recent orders power the "what is this about?" picker in the composer.
  React.useEffect(() => {
    if (!token || !composerOpen || recentOrders.length > 0) return;
    let active = true;
    (async () => {
      try {
        const result = await listBuyerOrders(token);
        if (active) setRecentOrders((result.orders ?? []).slice(0, 8));
      } catch {
        // Non-fatal: the ticket can still be raised without an order attached.
      }
    })();
    return () => {
      active = false;
    };
  }, [token, composerOpen, recentOrders.length]);

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) {
      showToast("Add a subject and a message.", "info");
      return;
    }
    setCreating(true);
    try {
      const { ticket } = await createSupportTicket(
        {
          subject: subject.trim(),
          category,
          message: message.trim(),
          ...(selectedOrderId ? { orderId: selectedOrderId } : {}),
        },
        token
      );
      setTickets((prev) => [ticket, ...prev]);
      setComposerOpen(false);
      setSubject("");
      setMessage("");
      setCategory("OTHER");
      setSelectedOrderId(null);
      router.push({
        pathname: "/support/[id]",
        params: { id: ticket.id, subject: ticket.subject, status: ticket.status },
      });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to raise the request",
        "error"
      );
    } finally {
      setCreating(false);
    }
  };

  if (!authLoading && !token) {
    return (
      <SafeAreaView style={styles.screen}>
        <AppHeader title="Support" />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Log in to chat with the KTMONA support team.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/login")}>
            <Text style={styles.primaryButtonText}>Log in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="Support" />

      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          tickets.length === 0 ? styles.listEmpty : styles.list,
          { paddingBottom: bottomBarHeight + spacing.xxl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.gold}
          />
        }
        ListEmptyComponent={
          loading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : (
            <View style={styles.empty}>
              <Icon
                name="chatbubble-ellipses-outline"
                size={40}
                color={colors.brownSoft}
              />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Raise a request about an order, a payment or your account and our
                team will reply right here.
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setComposerOpen(true)}
              >
                <Text style={styles.primaryButtonText}>Start a support chat</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: "/support/[id]",
                params: { id: item.id, subject: item.subject, status: item.status },
              })
            }
          >
            <View style={styles.rowTop}>
              <Text style={styles.rowSubject} numberOfLines={1}>
                {item.subject}
              </Text>
              {item.unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.rowPreview} numberOfLines={1}>
              {item.lastMessagePreview ?? "No messages yet"}
            </Text>
            <View style={styles.rowMeta}>
              <Text style={styles.rowStatus}>
                {SUPPORT_STATUS_LABELS[item.status]}
              </Text>
              <Text style={styles.rowTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable
        style={[styles.fab, { bottom: bottomBarHeight + spacing.md }]}
        onPress={() => setComposerOpen(true)}
      >
        <Icon name="add" size={18} color={colors.warmWhite} />
        <Text style={styles.fabText}>New request</Text>
      </Pressable>

      <Modal
        visible={composerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setComposerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>How can we help?</Text>

            <Text style={styles.label}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Briefly, what is this about?"
              placeholderTextColor={colors.brownSoft}
              style={styles.input}
            />

            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {CATEGORIES.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setCategory(value)}
                    style={[styles.chip, category === value && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        category === value && styles.chipTextActive,
                      ]}
                    >
                      {SUPPORT_CATEGORY_LABELS[value]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {recentOrders.length > 0 ? (
              <>
                <Text style={styles.label}>Which order? (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.orderRow}>
                    {recentOrders.map((order) => {
                      const active = order.id === selectedOrderId;
                      const firstItem = order.items?.[0];
                      const extra = (order.items?.length ?? 0) - 1;
                      return (
                        <Pressable
                          key={order.id}
                          onPress={() =>
                            setSelectedOrderId(active ? null : order.id)
                          }
                          style={[styles.orderCard, active && styles.orderCardActive]}
                        >
                          {firstItem?.productImage ? (
                            <Image
                              source={{ uri: firstItem.productImage }}
                              style={styles.orderThumb}
                              contentFit="cover"
                              width={72}
                            />
                          ) : (
                            <View style={[styles.orderThumb, styles.orderThumbFallback]}>
                              <Text style={styles.orderThumbText}>
                                {(firstItem?.productTitle ?? "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.orderTitle} numberOfLines={2}>
                            {firstItem?.productTitle ?? "Order"}
                            {extra > 0 ? ` +${extra} more` : ""}
                          </Text>
                          <Text style={styles.orderMeta}>
                            {new Date(order.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.label}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what happened…"
              placeholderTextColor={colors.brownSoft}
              multiline
              style={[styles.input, styles.textArea]}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.primaryButton}
                onPress={handleCreate}
                disabled={creating}
              >
                <Text style={styles.primaryButtonText}>
                  {creating ? "Sending…" : "Raise request"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.ghostButton}
                onPress={() => setComposerOpen(false)}
              >
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: "flex-start", padding: spacing.lg },
  empty: {
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    color: colors.foreground,
    fontFamily: typography.serif,
    fontSize: 20,
    textAlign: "center",
  },
  emptyText: {
    color: colors.brownSoft,
    fontFamily: typography.sans,
    fontSize: 14,
    textAlign: "center",
  },
  row: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowSubject: {
    flex: 1,
    color: colors.foreground,
    fontFamily: typography.sansMedium,
    fontSize: 15,
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.gold,
  },
  badgeText: {
    color: colors.warmWhite,
    fontSize: 11,
    fontFamily: typography.sansMedium,
    textAlign: "center",
  },
  rowPreview: { color: colors.brownSoft, fontFamily: typography.sans, fontSize: 13 },
  rowMeta: { flexDirection: "row", justifyContent: "space-between" },
  rowStatus: {
    color: colors.gold,
    fontFamily: typography.sansMedium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  rowTime: { color: colors.brownSoft, fontFamily: typography.sans, fontSize: 11 },
  fab: {
    position: "absolute",
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.charcoal,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  fabText: {
    color: colors.warmWhite,
    fontFamily: typography.sansMedium,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    color: colors.foreground,
    fontFamily: typography.serif,
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.brownSoft,
    fontFamily: typography.sansMedium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    color: colors.foreground,
    fontFamily: typography.sans,
    fontSize: 14,
    padding: spacing.md,
  },
  textArea: { minHeight: 110, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.cream },
  chipText: { color: colors.brownSoft, fontFamily: typography.sans, fontSize: 12 },
  chipTextActive: { color: colors.foreground },
  orderRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
  orderCard: {
    borderRadius: radius.lg,
    width: 108,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.sm,
    gap: 4,
  },
  orderCardActive: { borderColor: colors.gold, backgroundColor: colors.cream },
  orderThumb: {
    width: "100%",
    height: 84,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  orderThumbFallback: { alignItems: "center", justifyContent: "center" },
  orderThumbText: {
    fontFamily: typography.serif,
    fontSize: 22,
    color: colors.brownSoft,
  },
  orderTitle: {
    fontFamily: typography.sans,
    fontSize: 11,
    lineHeight: 15,
    color: colors.charcoal,
  },
  orderMeta: { fontFamily: typography.sans, fontSize: 10, color: colors.brownSoft },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  primaryButton: {
    borderRadius: radius.md,
    backgroundColor: colors.charcoal,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.warmWhite,
    fontFamily: typography.sansMedium,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  ghostButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  ghostButtonText: { color: colors.brownSoft, fontFamily: typography.sans, fontSize: 13 },
});
