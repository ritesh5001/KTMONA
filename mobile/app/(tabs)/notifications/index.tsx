import * as React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, radius, spacing, typography, shadow } from "../../../src/theme/tokens";
import {
  listNotifications,
  markNotificationRead,
  type AppNotification,
} from "../../../src/services/notifications";
import { ApiError, isAbortError } from "../../../src/services/api";
import { useAuth } from "../../../src/hooks/useAuth";
import { useToast } from "../../../src/providers/ToastProvider";
import { useNotifications } from "../../../src/providers/NotificationProvider";
import { SkeletonNotificationRow } from "../../../src/components/Skeleton";
import { AnimatedPressable } from "../../../src/components/AnimatedPressable";
import { AppHeader } from "../../../src/components/AppHeader";
import { Icon } from "../../../src/components/Icon";
import { impactLight } from "../../../src/utils/haptics";
import { BrandLoader } from "../../../src/components/BrandLoader";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../../src/components";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function NotificationsScreen() {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.accessToken ?? null;
  const { showToast } = useToast();
  const { decrementUnread } = useNotifications();

  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const showGuestState = !authLoading && !token;

  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---- Fetch page ----
  const fetchPage = React.useCallback(
    async (pageNum: number, opts?: { replace?: boolean }) => {
      if (!token) return;
      if (pageNum === 1 && !opts?.replace) setLoading(true);
      setError(null);

      try {
        const result = await listNotifications(
          { page: pageNum, limit: PAGE_SIZE },
          token
        );
        if (!mountedRef.current) return;

        const incoming = result.data ?? [];
        const total = result.meta?.total ?? 0;

        if (opts?.replace) {
          setItems(incoming);
        } else {
          setItems((prev) =>
            pageNum === 1 ? incoming : [...prev, ...incoming]
          );
        }

        setPage(pageNum);
        setHasMore(pageNum * PAGE_SIZE < total);
      } catch (err) {
        if (!mountedRef.current || isAbortError(err)) return;
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load notifications.";
        setError(message);
        showToast(message, "error");
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [token, showToast]
  );

  // Initial load
  React.useEffect(() => {
    if (!authLoading && token) fetchPage(1);
  }, [authLoading, token, fetchPage]);

  // Pull to refresh
  const onRefresh = React.useCallback(() => {
    impactLight();
    setRefreshing(true);
    fetchPage(1, { replace: true });
  }, [fetchPage]);

  // Infinite scroll
  const onEndReached = React.useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPage(page + 1);
  }, [loadingMore, hasMore, page, fetchPage]);

  // ---- Mark as read + navigate ----
  const handlePress = React.useCallback(
    async (item: AppNotification) => {
      // Optimistic: mark read locally
      if (!item.isRead) {
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        decrementUnread();

        // Fire-and-forget backend call
        if (token) {
          markNotificationRead(item.id, token).catch(() => {
            // Revert optimistic update on failure
            if (mountedRef.current) {
              setItems((prev) =>
                prev.map((n) =>
                  n.id === item.id ? { ...n, isRead: false } : n
                )
              );
            }
          });
        }
      }

      // Deep link
      if (item.meta?.orderId) {
        router.push(`/orders/${item.meta.orderId}/tracking`);
      }
    },
    [token, decrementUnread, router]
  );

  // ---- Render helpers ----
  const renderItem = React.useCallback(
    ({ item }: { item: AppNotification }) => (
      <AnimatedPressable
        style={[
          styles.card,
          !item.isRead && styles.cardUnread,
        ]}
        onPress={() => handlePress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.isRead ? "" : "Unread notification. "}${item.title}. ${item.message}`}
        accessibilityHint={
          item.meta?.orderId ? "Opens order tracking" : "Marks this notification as read"
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.cardMessage} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.cardDate}>
          {formatDate(item.createdAt)}
        </Text>
      </AnimatedPressable>
    ),
    [handlePress]
  );

  const keyExtractor = React.useCallback(
    (item: AppNotification) => item.id,
    []
  );

  const ListFooter = React.useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <BrandLoader size="sm" color={colors.gold} />
      </View>
    );
  }, [loadingMore]);

  if (showGuestState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Notifications" subtitle="Updates & offers" showBack />
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Icon name="notifications-outline" size={34} color={colors.brownSoft} />
          </View>
          <Text style={styles.emptyTitle}>Sign in to view notifications</Text>
          <Text style={styles.emptySubtitle}>
            Get order updates, delivery alerts, and offers linked to your account.
          </Text>
          <AnimatedPressable
            onPress={() => router.push("/login?returnTo=%2Fnotifications")}
            style={styles.ctaButton}
            accessibilityRole="button"
            accessibilityLabel="Sign in to view notifications"
          >
            <Text style={styles.ctaButtonText}>Sign in</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => router.push("/home")}
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel="Explore home"
          >
            <Text style={styles.secondaryButtonText}>Explore home</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Main render ----
  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title="Notifications" subtitle="Updates & offers" showBack />

      {loading && !refreshing ? (
        <View style={styles.listContent}>
          <SkeletonNotificationRow />
          <SkeletonNotificationRow />
          <SkeletonNotificationRow />
          <SkeletonNotificationRow />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Icon name="notifications-outline" size={34} color={colors.brownSoft} />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => fetchPage(1)}
            accessibilityRole="button"
            accessibilityLabel="Retry loading notifications"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Icon name="notifications-outline" size={34} color={colors.brownSoft} />
          </View>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptyText}>
            You have no notifications yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={ListFooter}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          // Rows contain an AnimatedPressable; clipping a view out from under a
          // running layout animation crashes the Android view manager.
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  cardUnread: {
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    flex: 1,
    fontFamily: typography.serif,
    fontSize: 15,
    color: colors.charcoal,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    marginLeft: spacing.sm,
  },
  cardMessage: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    lineHeight: 18,
  },
  cardDate: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.gold,
  },

  // States
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  emptyCard: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    ...shadow.card,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 18,
    color: colors.charcoal,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
  },
  ctaButton: {
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  ctaButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.background,
  },
  secondaryButton: {
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.foreground,
  },
  errorTitle: {
    fontFamily: typography.serif,
    fontSize: 18,
    color: colors.charcoal,
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: "center",
  },
  retryText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.background,
  },
  footer: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
});
