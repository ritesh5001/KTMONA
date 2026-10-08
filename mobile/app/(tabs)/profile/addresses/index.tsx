import * as React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Modal,
  Pressable,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import {
  colors,
  radius,
  spacing,
  typography,
  shadow,
} from "../../../../src/theme/tokens";
import { useAuth } from "../../../../src/hooks/useAuth";
import { useAddresses } from "../../../../src/providers/AddressProvider";
import { AnimatedPressable } from "../../../../src/components/AnimatedPressable";
import { impactLight, notifySuccess, notifyError } from "../../../../src/utils/haptics";
import type { Address } from "../../../../src/services/addresses";
import { BrandLoader } from "../../../../src/components/BrandLoader";
import { AppHeader } from "../../../../src/components/AppHeader";
import { Icon } from "../../../../src/components/Icon";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../../../src/components";

// ---------------------------------------------------------------------------
// Row component — memoized for FlatList performance
// ---------------------------------------------------------------------------

interface AddressRowProps {
  item: Address;
  isMutating: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

const AddressRow = React.memo(function AddressRow({
  item,
  isMutating,
  onEdit,
  onDelete,
  onSetDefault,
}: AddressRowProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.labelRow}>
          <Text style={styles.labelBadge}>{item.label}</Text>
          {item.isDefault && (
            <Text style={styles.defaultBadge}>Default</Text>
          )}
        </View>
      </View>

      <Text style={styles.addressLine}>{item.addressLine1}</Text>
      {item.addressLine2 ? (
        <Text style={styles.addressLine}>{item.addressLine2}</Text>
      ) : null}
      <Text style={styles.addressLine}>
        {item.city}, {item.state} — {item.pincode}
      </Text>

      <View style={styles.cardActions}>
        {!item.isDefault && (
          <AnimatedPressable
            style={styles.actionButton}
            onPress={() => onSetDefault(item.id)}
            disabled={isMutating}
            accessibilityRole="button"
            accessibilityLabel={`Set ${item.label} address as default`}
            accessibilityState={{ disabled: isMutating }}
          >
            <Text style={styles.actionButtonText}>Set default</Text>
          </AnimatedPressable>
        )}
        <AnimatedPressable
          style={styles.actionButton}
          onPress={() => onEdit(item.id)}
          disabled={isMutating}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.label} address`}
          accessibilityState={{ disabled: isMutating }}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.actionButton, styles.dangerButton]}
          onPress={() => onDelete(item.id)}
          disabled={isMutating}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.label} address`}
          accessibilityState={{ disabled: isMutating }}
        >
          <Text style={[styles.actionButtonText, styles.dangerText]}>
            Delete
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AddressesScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.accessToken ?? null;
  const showGuestState = !authLoading && !token;
  const {
    addresses,
    isLoading,
    fetchError,
    mutatingIds,
    refreshAddresses,
    removeAddress,
    setDefault,
  } = useAddresses();

  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleGoBack = React.useCallback(() => {
    router.back();
  }, [router]);

  // ---- Handlers (stable references) ----

  const handleEdit = React.useCallback(
    (id: string) => {
      router.push(`/profile/addresses/form?id=${id}`);
    },
    [router],
  );

  const handleDelete = React.useCallback((id: string) => {
    impactLight();
    setDeleteTarget(id);
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await removeAddress(deleteTarget);
      notifySuccess();
    } catch {
      notifyError();
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, removeAddress]);

  const cancelDelete = React.useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleSetDefault = React.useCallback(
    async (id: string) => {
      impactLight();
      await setDefault(id);
      notifySuccess();
    },
    [setDefault],
  );

  const handleAdd = React.useCallback(() => {
    router.push("/profile/addresses/form");
  }, [router]);

  // ---- Stable key extractor ----
  const keyExtractor = React.useCallback((item: Address) => item.id, []);

  const renderItem = React.useCallback(
    ({ item }: { item: Address }) => (
      <AddressRow
        item={item}
        isMutating={mutatingIds.has(item.id)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSetDefault={handleSetDefault}
      />
    ),
    [mutatingIds, handleEdit, handleDelete, handleSetDefault],
  );

  const ListEmpty = React.useMemo(
    () =>
      !isLoading ? (
        <View style={styles.emptyContainer}>
          <Icon name="location-outline" size={38} color={colors.brownSoft} />
          <Text style={styles.emptyTitle}>No saved addresses</Text>
          <Text style={styles.emptySubtitle}>
            Add a delivery address to speed up checkout.
          </Text>
        </View>
      ) : null,
    [isLoading],
  );

  if (showGuestState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Addresses" subtitle="Delivery details" showBack />
        <View style={styles.emptyContainer}>
          <Icon name="location-outline" size={38} color={colors.brownSoft} />
          <Text style={styles.emptyTitle}>No saved addresses</Text>
          <Text style={styles.emptySubtitle}>
            Add a delivery address when you&apos;re ready to check out.
          </Text>
          <AnimatedPressable
            onPress={handleGoBack}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
          >
            <Text style={styles.primaryButtonText}>Back to profile</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title="Addresses" subtitle="Delivery details" showBack />

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <BrandLoader label="Loading addresses" color={colors.gold} />
        </View>
      ) : fetchError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{fetchError}</Text>
          <AnimatedPressable
            style={styles.primaryButton}
            onPress={refreshAddresses}
            accessibilityRole="button"
            accessibilityLabel="Retry loading addresses"
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + 116 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add button — always visible at bottom */}
      <View style={[styles.addButtonContainer, { bottom: tabBarHeight }]}> 
        <AnimatedPressable
          style={styles.primaryButton}
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel="Add new address"
        >
          <Text style={styles.primaryButtonText}>+ Add new address</Text>
        </AnimatedPressable>
      </View>

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay} accessibilityViewIsModal>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Address</Text>
            <Text style={styles.modalMessage}>
              This address will be permanently removed. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={cancelDelete}
                disabled={isDeleting}
                accessibilityRole="button"
                accessibilityLabel="Cancel deleting address"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <AnimatedPressable
                style={[
                  styles.modalConfirmButton,
                  isDeleting && styles.buttonDisabled,
                ]}
                onPress={confirmDelete}
                disabled={isDeleting}
                accessibilityRole="button"
                accessibilityLabel="Confirm deleting address"
                accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
              >
                {isDeleting ? (
                  <BrandLoader size="sm" color={colors.background} />
                ) : (
                  <Text style={styles.modalConfirmText}>Delete</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  labelBadge: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.gold,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  defaultBadge: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.gold,
    backgroundColor: "rgba(184, 149, 108, 0.14)",
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  addressLine: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.charcoal,
    marginTop: 2,
    lineHeight: 19,
  },
  cardActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.md,
  },
  actionButton: {
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.charcoal,
  },
  dangerButton: {
    borderRadius: radius.md,
    borderColor: colors.error,
    backgroundColor: "#FBECEA",
  },
  dangerText: {
    color: colors.error,
  },

  // Empty / loading
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 18,
    color: colors.charcoal,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
    lineHeight: 18,
  },

  // Add button
  addButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  primaryButton: {
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
  buttonDisabled: {
    opacity: 0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  modalTitle: {
    fontFamily: typography.serif,
    fontSize: 20,
    color: colors.charcoal,
  },
  modalMessage: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.brownSoft,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  modalCancelText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.foreground,
  },
  modalConfirmButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    minWidth: 90,
    alignItems: "center",
  },
  modalConfirmText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.background,
  },
});
