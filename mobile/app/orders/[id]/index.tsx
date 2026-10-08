import * as React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  type ListRenderItemInfo,
  FlatList,
} from "react-native";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { colors, radius, spacing, typography, shadow } from "../../../src/theme/tokens";
import {
  getBuyerOrderDetail,
  downloadInvoice,
  type BuyerOrderDetail,
  type OrderItem,
} from "../../../src/services/orders";
import { useAuth } from "../../../src/hooks/useAuth";
import { useToast } from "../../../src/providers/ToastProvider";
import { ApiError, isAbortError } from "../../../src/services/api";
import { SkeletonBlock } from "../../../src/components/Skeleton";
import { AnimatedPressable } from "../../../src/components/AnimatedPressable";
import { DeliveredShimmer } from "../../../src/components/DeliveredShimmer";
import { impactLight } from "../../../src/utils/haptics";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../../src/components";
import { AppHeader } from "../../../src/components/AppHeader";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type OrderDetailCacheEntry = {
  token: string;
  cachedAt: number;
  order: BuyerOrderDetail;
  paymentStatus: string | null;
};

const ORDER_DETAIL_CACHE_TTL_MS = 2 * 60 * 1000;
const orderDetailCache = new Map<string, OrderDetailCacheEntry>();

// ---------------------------------------------------------------------------
// Memoised sub-components
// ---------------------------------------------------------------------------

const OrderItemRow = React.memo(function OrderItemRow({
  item,
}: {
  item: OrderItem;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.productTitle ?? "Product"}</Text>
        <Text style={styles.itemSku}>
          {item.variantSku ?? "—"} × {item.quantity}
        </Text>
      </View>
      <Text style={styles.itemPrice}>
        {currency.format(item.priceSnapshot * item.quantity)}
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PLACED: { label: "PLACED", color: colors.brownSoft },
  CONFIRMED: { label: "CONFIRMED", color: colors.gold },
  PROCESSING: { label: "PROCESSING", color: colors.gold },
  SHIPPED: { label: "SHIPPED", color: "#B84A00" },
  DELIVERED: { label: "DELIVERED", color: "#8A3A00" },
  CANCELLED: { label: "CANCELLED", color: colors.gold },
  "PAYMENT PENDING": { label: "PAYMENT PENDING", color: colors.gold },
  "PAYMENT FAILED": { label: "PAYMENT FAILED", color: colors.gold },
};

const STATUS_FLOW = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"] as const;

function getStatusInfo(status: string, paymentStatus?: string | null) {
  if (status === "PLACED") {
    if (paymentStatus === "FAILED") return STATUS_LABELS["PAYMENT FAILED"];
    if (paymentStatus && paymentStatus !== "SUCCESS") {
      return STATUS_LABELS["PAYMENT PENDING"];
    }
  }
  return STATUS_LABELS[status] ?? { label: status, color: colors.brownSoft };
}

function normalizeStatusForTimeline(status: string) {
  if (status === "PROCESSING") return "CONFIRMED";
  if (status === "CANCELLED") return "CANCELLED";
  return status;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function OrderDetailScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { id: orderId } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.accessToken ?? null;
  const { showToast } = useToast();

  const [order, setOrder] = React.useState<BuyerOrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = React.useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = React.useState(false);

  const mountedRef = React.useRef(true);
  const requestAbortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestAbortRef.current?.abort();
    };
  }, []);

  // ---- Fetch order detail ----
  const fetchOrder = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!orderId || !token) return;

      const cacheKey = `${token}:${orderId}`;
      const cached = orderDetailCache.get(cacheKey);
      const isCacheValid =
        !!cached && Date.now() - cached.cachedAt < ORDER_DETAIL_CACHE_TTL_MS;

      if (isCacheValid) {
        setOrder(cached.order);
        setPaymentStatus(cached.paymentStatus);
        setError(null);
      }

      if (!opts?.silent) setLoading(!isCacheValid);
      setError(null);

      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      try {
        const orderRes = await getBuyerOrderDetail(orderId, token, controller.signal);
        if (!mountedRef.current) return;
        setOrder(orderRes.order);
        const nextPaymentStatus = (orderRes.order as any)?.paymentStatus ?? null;
        setPaymentStatus(nextPaymentStatus);

        orderDetailCache.set(cacheKey, {
          token,
          cachedAt: Date.now(),
          order: orderRes.order,
          paymentStatus: nextPaymentStatus,
        });
      } catch (err) {
        if (isAbortError(err) || !mountedRef.current) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load order";
        setError(msg);
        if (opts?.silent) showToast(msg, "error");
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

  React.useEffect(() => {
    if (authLoading) return;
    if (!token) {
      const returnTo = encodeURIComponent(pathname || `/orders/${orderId}`);
      router.replace(`/login?returnTo=${returnTo}`);
      return;
    }
    fetchOrder();
  }, [authLoading, token, router, fetchOrder, pathname, orderId]);

  const onRefresh = React.useCallback(() => {
    impactLight();
    setRefreshing(true);
    fetchOrder({ silent: true });
  }, [fetchOrder]);

  // ---- Item list callbacks ----
  const itemKeyExtractor = React.useCallback((item: OrderItem) => item.id, []);

  const renderOrderItem = React.useCallback(
    ({ item }: ListRenderItemInfo<OrderItem>) => <OrderItemRow item={item} />,
    []
  );

  // ---- Derived ----
  const statusInfo = order ? getStatusInfo(order.status, paymentStatus) : null;
  const isDelivered = order?.status === "DELIVERED";
  const showPaymentWarning =
    order?.status === "PLACED" &&
    paymentStatus != null &&
    paymentStatus !== "SUCCESS";
  const timelineStatus = normalizeStatusForTimeline(order?.status ?? "PLACED");
  const activeStepIndex = STATUS_FLOW.indexOf(
    timelineStatus as (typeof STATUS_FLOW)[number]
  );
  const payableTotal =
    typeof order?.grandTotal === "number" && order.grandTotal > 0
      ? order.grandTotal
      : order?.totalAmount ?? 0;
  // ---- Loading ----
  if (loading && !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Order details" subtitle="Purchase summary" showBack />
        <View style={styles.skeletonWrap}>
          <SkeletonBlock width="60%" height={16} />
          <SkeletonBlock width="30%" height={12} style={{ marginTop: spacing.sm }} />
          <SkeletonBlock width="100%" height={60} style={{ marginTop: spacing.md }} />
          <SkeletonBlock width="100%" height={60} style={{ marginTop: spacing.sm }} />
        </View>
      </SafeAreaView>
    );
  }

  // ---- Error ----
  if (error && !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Order details" subtitle="Purchase summary" showBack />
        <View style={styles.centerCard}>
          <Text style={styles.errorTitle}>Unable to load order</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => fetchOrder()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading order"
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title="Order details"
        subtitle={`Order ${orderId?.slice(0, 8).toUpperCase() ?? ""}`}
        showBack
      />

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
        {/* Status banner */}
        {showPaymentWarning && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              {paymentStatus === "FAILED"
                ? "Payment failed — retry payment from your orders screen."
                : "Payment pending — complete your payment to confirm this order."}
            </Text>
          </View>
        )}

        {/* Status timeline */}
        {timelineStatus === "CANCELLED" ? (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledTitle}>Order cancelled</Text>
            <Text style={styles.cancelledCopy}>
              Your order was cancelled. If you need help, reach out to support.
            </Text>
          </View>
        ) : (
          <View style={styles.timelineCard}>
            <Text style={styles.sectionTitle}>Order progress</Text>
            <View style={styles.timelineRow}>
              {STATUS_FLOW.map((step, index) => {
                const isActive = index <= activeStepIndex;
                return (
                  <View key={step} style={styles.timelineStep}>
                    <View
                      style={[
                        styles.timelineDot,
                        isActive && styles.timelineDotActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.timelineLabel,
                        isActive && styles.timelineLabelActive,
                      ]}
                    >
                      {step}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Order summary card */}
        <DeliveredShimmer active={isDelivered}>
          <View style={[
            styles.card,
            isDelivered && { borderColor: colors.gold, borderWidth: 1.5 },
          ]}>
          <View style={styles.summaryRow}>
            <Text style={styles.orderId}>
              Order {order.id.slice(0, 8).toUpperCase()}
            </Text>
            {statusInfo && (
              <Text style={[styles.statusBadge, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            )}
          </View>
          <Text style={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {currency.format(payableTotal)}
            </Text>
          </View>
        </View>
        </DeliveredShimmer>

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Items ({order.items.length})
          </Text>
          <FlatList
            data={order.items}
            keyExtractor={itemKeyExtractor}
            renderItem={renderOrderItem}
            scrollEnabled={false}
            initialNumToRender={10}
          />
        </View>

        {/* Shipping address */}
        {order.shippingAddressLine1 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            {order.shippingName && (
              <Text style={styles.addressLine}>{order.shippingName}</Text>
            )}
            <Text style={styles.addressLine}>
              {order.shippingAddressLine1}
            </Text>
            {order.shippingAddressLine2 && (
              <Text style={styles.addressLine}>
                {order.shippingAddressLine2}
              </Text>
            )}
            {order.shippingCity && (
              <Text style={styles.addressLine}>{order.shippingCity}</Text>
            )}
            {order.shippingPhone && (
              <Text style={styles.addressMeta}>
                Phone: {order.shippingPhone}
              </Text>
            )}
            {order.shippingEmail && (
              <Text style={styles.addressMeta}>
                Email: {order.shippingEmail}
              </Text>
            )}
            {order.shippingNotes && (
              <Text style={styles.addressMeta}>
                Notes: {order.shippingNotes}
              </Text>
            )}
          </View>
        )}

        {/* Download Invoice — for confirmed/shipped/delivered orders */}
        {order && (order.status === "CONFIRMED" || order.status === "SHIPPED" || order.status === "DELIVERED") && (
          <AnimatedPressable
            style={[styles.primaryButton, { backgroundColor: colors.gold, marginBottom: spacing.sm }]}
            onPress={async () => {
              if (downloadingInvoice || !token || !orderId) return;
              setDownloadingInvoice(true);
              try {
                await downloadInvoice(orderId, token);
              } catch (err) {
                showToast(
                  err instanceof Error ? err.message : "Unable to download invoice",
                  "error"
                );
              } finally {
                setDownloadingInvoice(false);
              }
            }}
            disabled={downloadingInvoice}
          >
            <Text style={styles.primaryButtonText}>
              {downloadingInvoice ? "Downloading..." : "Download Invoice"}
            </Text>
          </AnimatedPressable>
        )}

        {/* Track order button */}
        <AnimatedPressable
          style={styles.primaryButton}
          onPress={() => router.push(`/orders/${orderId}/tracking`)}
        >
          <Text style={styles.primaryButtonText}>Track Shipment</Text>
        </AnimatedPressable>
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Warning
  warningBanner: {
    backgroundColor: "rgba(184, 149, 108, 0.14)",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  warningText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gold,
    lineHeight: 18,
  },

  cancelledBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  cancelledTitle: {
    fontFamily: typography.serif,
    fontSize: 16,
    color: colors.charcoal,
  },
  cancelledCopy: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    lineHeight: 18,
  },

  timelineCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  timelineRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timelineStep: {
    alignItems: "center",
    gap: spacing.xs,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.borderSoft,
  },
  timelineDotActive: {
    backgroundColor: colors.gold,
  },
  timelineLabel: {
    fontFamily: typography.sans,
    fontSize: 9,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  timelineLabelActive: {
    color: colors.charcoal,
  },

  // Cards
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  sectionTitle: {
    fontFamily: typography.serif,
    fontSize: 16,
    color: colors.charcoal,
    marginBottom: spacing.sm,
  },

  // Summary
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderId: {
    fontFamily: typography.serif,
    fontSize: 18,
    color: colors.charcoal,
  },
  statusBadge: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  orderDate: {
    marginTop: spacing.xs,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  totalLabel: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  totalValue: {
    fontFamily: typography.serif,
    fontSize: 20,
    color: colors.charcoal,
  },

  // Items
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.charcoal,
  },
  itemSku: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    marginTop: 2,
  },
  itemPrice: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.charcoal,
  },

  // Address
  addressLine: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 20,
  },
  addressMeta: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    marginTop: spacing.xs,
  },

  // Buttons
  primaryButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.background,
  },

  // Skeleton
  skeletonWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Error
  centerCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    ...shadow.card,
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
    marginBottom: spacing.md,
  },
});
