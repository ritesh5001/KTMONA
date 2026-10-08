import * as React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  AppState,
  type AppStateStatus,
} from "react-native";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { colors, radius, spacing, typography, shadow } from "../../../src/theme/tokens";
import {
  getOrderTracking,
  isTerminalStatus,
  type TrackingResponse,
  type ShipmentStatus,
} from "../../../src/services/shipping";
import { ApiError, isAbortError } from "../../../src/services/api";
import { ShippingTimeline } from "../../../src/components/ShippingTimeline";
import { BrandLoader } from "../../../src/components/BrandLoader";
import { useToast } from "../../../src/providers/ToastProvider";
import { useAuth } from "../../../src/hooks/useAuth";
import { impactLight } from "../../../src/utils/haptics";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../../src/components";
import { AppHeader } from "../../../src/components/AppHeader";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 30_000;
const TRACKING_CACHE_TTL_MS = 60 * 1000;

type TrackingCacheEntry = {
  token: string;
  cachedAt: number;
  tracking: TrackingResponse;
  lastFetchedAt: string | null;
};

const trackingCache = new Map<string, TrackingCacheEntry>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function relativeTime(iso: string | undefined | null): string {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) return "";
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function TrackingScreen() {
  const { id: orderId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.accessToken ?? null;
  const { showToast } = useToast();

  const [tracking, setTracking] = React.useState<TrackingResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = React.useState<string | null>(null);

  // Track whether screen is mounted to prevent set-state after unmount
  const mountedRef = React.useRef(true);
  const requestAbortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestAbortRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    if (!authLoading && !token) {
      const returnTo = encodeURIComponent(pathname || `/orders/${orderId}/tracking`);
      router.replace(`/login?returnTo=${returnTo}`);
    }
  }, [authLoading, token, pathname, orderId, router]);

  // ---- Fetch logic ----
  const fetchTracking = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!orderId || !token) return;

      const cacheKey = `${token}:${orderId}`;
      const cached = trackingCache.get(cacheKey);
      const isCacheValid =
        !!cached && Date.now() - cached.cachedAt < TRACKING_CACHE_TTL_MS;

      if (isCacheValid) {
        setTracking(cached.tracking);
        setLastFetchedAt(cached.lastFetchedAt);
        setError(null);
      }

      if (!opts?.silent) setLoading(!isCacheValid);
      setError(null);

      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;

      try {
        const data = await getOrderTracking(orderId, token, controller.signal);
        if (mountedRef.current) {
          setTracking(data);
          const nextFetchedAt = new Date().toISOString();
          setLastFetchedAt(nextFetchedAt);

          trackingCache.set(cacheKey, {
            token,
            cachedAt: Date.now(),
            tracking: data,
            lastFetchedAt: nextFetchedAt,
          });
        }
      } catch (err) {
        if (!mountedRef.current || isAbortError(err)) return;
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load tracking info.";
        setError(message);
        if (opts?.silent) showToast(message, "error");
      } finally {
        if (requestAbortRef.current === controller) {
          requestAbortRef.current = null;
        }
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [orderId, token, showToast]
  );

  // Initial fetch
  React.useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // ---- AppState-aware polling ----
  // Stops permanently when DELIVERED. Pauses in background. Resumes on active.
  // Use a derived value (not the full tracking object) to avoid restarting
  // the interval on every successful poll response.
  const leadStatus: ShipmentStatus | undefined =
    tracking?.shipments?.[0]?.status;

  React.useEffect(() => {
    // Terminal → no polling ever
    if (leadStatus && isTerminalStatus(leadStatus)) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return; // prevent duplicate intervals
      intervalId = setInterval(() => {
        fetchTracking({ silent: true });
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Start immediately if app is active
    if (AppState.currentState === "active") {
      startPolling();
    }

    const handleAppState = (next: AppStateStatus) => {
      if (next === "active") {
        // Fetch immediately on resume, then restart interval
        fetchTracking({ silent: true });
        startPolling();
      } else {
        stopPolling();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [leadStatus, fetchTracking]);

  // ---- Pull to refresh ----
  const onRefresh = React.useCallback(() => {
    impactLight();
    setRefreshing(true);
    fetchTracking({ silent: true });
  }, [fetchTracking]);

  // ---- Derived values ----
  const shipment = tracking?.shipments?.[0] ?? null;
  const shipmentStatus: ShipmentStatus = shipment?.status ?? "CREATED";
  const isDelivered = shipmentStatus === "DELIVERED";
  const timestamps: Partial<Record<ShipmentStatus, string | null>> = {
    CREATED: tracking?.shipments?.length
      ? shipment?.events?.find((e) => e.status === "CREATED")?.createdAt ?? null
      : null,
    SHIPPED: shipment?.shippedAt ?? null,
    DELIVERED: shipment?.deliveredAt ?? null,
  };
  const lastUpdatedLabel = relativeTime(lastFetchedAt);

  // ---- Render ----
  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title="Order tracking" subtitle="Live delivery updates" showBack />

      {/* Loading state */}
      {loading && !tracking ? (
        <View style={styles.center}>
          <BrandLoader label="Loading tracking" color={colors.gold} />
        </View>
      ) : error && !tracking ? (
        /* Error state with retry */
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Unable to load tracking</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => fetchTracking()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading tracking"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
        >
          {/* Delivered success banner */}
          {isDelivered ? (
            <View style={styles.deliveredBanner}>
              <Text style={styles.deliveredText}>
                Your order has been delivered
              </Text>
            </View>
          ) : null}

          {/* Order summary card */}
          <View style={styles.card}>
            <Text style={styles.orderId}>
              Order {orderId?.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={styles.orderStatus}>
              {tracking?.status ?? "—"}
            </Text>
          </View>

          {/* Timeline */}
          {shipment ? (
            <View style={styles.card}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Shipment progress</Text>
                {lastUpdatedLabel ? (
                  <Text style={styles.lastUpdated}>
                    Updated {lastUpdatedLabel}
                  </Text>
                ) : null}
              </View>
              <ShippingTimeline
                status={shipmentStatus}
                timestamps={timestamps}
              />

              {/* Carrier info */}
              {shipment.carrier ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Carrier</Text>
                  <Text style={styles.metaValue}>{shipment.carrier}</Text>
                </View>
              ) : null}
              {shipment.trackingNumber ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Tracking #</Text>
                  <Text style={styles.metaValue}>
                    {shipment.trackingNumber}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.noShipment}>
                No shipment information available yet.
              </Text>
            </View>
          )}

          {/* Event log */}
          {shipment && shipment.events.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Activity</Text>
              {shipment.events
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )
                .map((event) => (
                  <View key={event.id} style={styles.eventRow}>
                    <Text style={styles.eventStatus}>{event.status}</Text>
                    <Text style={styles.eventNote}>
                      {event.note ?? "—"}
                    </Text>
                    <Text style={styles.eventDate}>
                      {new Date(event.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Centered states
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
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
  },
  retryText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.background,
  },

  // Scroll content
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  orderId: {
    fontFamily: typography.serif,
    fontSize: 16,
    color: colors.charcoal,
  },
  orderStatus: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastUpdated: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.brownSoft,
    marginBottom: spacing.md,
  },
  deliveredBanner: {
    backgroundColor: "rgba(184, 149, 108, 0.14)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  deliveredText: {
    fontFamily: typography.serif,
    fontSize: 15,
    color: colors.gold,
    textAlign: "center",
  },
  noShipment: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
    paddingVertical: spacing.md,
  },

  // Carrier meta
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    marginTop: spacing.sm,
  },
  metaLabel: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  metaValue: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.charcoal,
  },

  // Event log
  eventRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  eventStatus: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 1.0,
  },
  eventNote: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.charcoal,
  },
  eventDate: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
  },
});
