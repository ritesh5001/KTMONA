import * as React from "react";
import { View, StyleSheet, Pressable, ScrollView, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Icon, type IconName } from "../../../src/components/Icon";
import Constants from "expo-constants";
import { colors, spacing, typography, shadow, radius } from "../../../src/theme/tokens";
import { useAuth } from "../../../src/hooks/useAuth";
import { AnimatedPressable } from "../../../src/components/AnimatedPressable";
import { AppHeader } from "../../../src/components/AppHeader";
import { ProfileAvatar } from "../../../src/components/ProfileAvatar";
import { BrandLoader } from "../../../src/components/BrandLoader";
import { AppText as Text, ScreenContainer as SafeAreaView } from "../../../src/components";

/** Primary destinations — icon, label and a one-line explanation. */
const ACCOUNT_ACTIONS: {
  icon: IconName;
  label: string;
  caption: string;
  href: string;
}[] = [
  {
    icon: "bag-handle-outline",
    label: "My Orders",
    caption: "Check your order history",
    href: "/orders",
  },
  {
    icon: "heart-outline",
    label: "My Wishlist",
    caption: "View products on your wishlist",
    href: "/wishlist",
  },
  {
    icon: "location-outline",
    label: "Address",
    caption: "Manage my addresses",
    href: "/profile/addresses",
  },
  {
    icon: "chatbubble-ellipses-outline",
    label: "Support Chat",
    caption: "Talk to our team",
    href: "/support",
  },
  {
    icon: "lock-closed-outline",
    label: "Reset Password",
    caption: "Change your account password",
    href: "/forgot-password",
  },
];

/** Secondary links, laid out as a two-column footer grid. */
const POLICY_LINKS: { label: string; href: string }[] = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Contact Us", href: "/contact" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Return Policy", href: "/return-policy" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Vendor Agreement", href: "/vendor-agreement" },
];

const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? "3.2";

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut, isLoading } = useAuth();
  const user = session?.user;

  const displayName = React.useMemo(() => {
    if (!user) return "KTMONA User";
    if (user.fullName?.trim()) return user.fullName.trim();
    if (user.email) return user.email.split("@")[0];
    return "KTMONA User";
  }, [user]);

  const contactLine = user?.phone ?? user?.email ?? "";
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleLogout = React.useCallback(async () => {
    setLoggingOut(true);
    try {
      await signOut();
      if (mountedRef.current) {
        setShowLogoutModal(false);
        router.replace("/login");
      }
    } finally {
      if (mountedRef.current) setLoggingOut(false);
    }
  }, [signOut, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title="Profile"
        subtitle="Account & preferences"
        showBack={false}
        showMenu
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.card}>
            <BrandLoader label="Loading profile" color={colors.gold} />
          </View>
        ) : !user ? (
          <View style={styles.card}>
            <View style={styles.emptyIconWrap}>
              <Icon name="person" size={30} color={colors.brownSoft} />
            </View>
            <Text style={styles.emptyTitle}>Sign in to view profile</Text>
            <Text style={styles.emptySubtitle}>
              Manage addresses, orders, and account settings after login.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push("/login?returnTo=%2Fprofile")}
              accessibilityRole="button"
              accessibilityLabel="Sign in to view profile"
            >
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push("/home")}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
            >
              <Text style={styles.secondaryButtonText}>Back to home</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Identity banner */}
            <View style={styles.banner}>
              {/* Editable here and only here: this is the screen where changing
                  your picture is the point, so it carries the affordance. */}
              <ProfileAvatar size={56} editable />
              <View style={styles.bannerText}>
                <Text style={styles.bannerName} numberOfLines={1}>
                  {displayName}
                </Text>
                {contactLine ? (
                  <Text style={styles.bannerContact} numberOfLines={1}>
                    {contactLine}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setShowDetails((prev) => !prev)}
                hitSlop={10}
                style={styles.bannerAction}
                accessibilityRole="button"
                accessibilityLabel={showDetails ? "Hide account details" : "Show account details"}
                accessibilityState={{ expanded: showDetails }}
              >
                <Icon
                  name={showDetails ? "chevron-up" : "information-circle-outline"}
                  size={20}
                  color={colors.gold}
                />
              </Pressable>
            </View>

            {/* Account detail — collapsed so the actions stay above the fold */}
            {showDetails ? (
              <View style={styles.detailCard}>
                <DetailRow label="Account type" value={user.role ?? "USER"} />
                <DetailRow label="Account status" value={user.status ?? "ACTIVE"} />
                {user.email ? <DetailRow label="Email" value={user.email} /> : null}
                {user.phone ? <DetailRow label="Phone" value={user.phone} /> : null}
                <DetailRow
                  label="Email verified"
                  value={user.isEmailVerified ? "Yes" : "No"}
                />
                <DetailRow
                  label="Phone verified"
                  value={user.isPhoneVerified ? "Yes" : "No"}
                />
              </View>
            ) : null}

            {/* Primary actions */}
            <View style={styles.actionCard}>
              {ACCOUNT_ACTIONS.map((action, index) => (
                <AnimatedPressable
                  key={action.label}
                  style={[
                    styles.actionRow,
                    index === ACCOUNT_ACTIONS.length - 1 && styles.actionRowLast,
                  ]}
                  onPress={() => router.push(action.href as never)}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  accessibilityHint={action.caption}
                >
                  <View style={styles.actionIconWrap}>
                    <Icon name={action.icon} size={20} color={colors.gold} />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionLabel}>{action.label}</Text>
                    <Text style={styles.actionCaption}>{action.caption}</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.brownSoft} />
                </AnimatedPressable>
              ))}
            </View>

            {/* Policy grid */}
            <View style={styles.policyWrap}>
              {POLICY_LINKS.map((link) => (
                <Pressable
                  key={link.label}
                  style={styles.policyItem}
                  onPress={() => router.push(link.href as never)}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                >
                  <Text style={styles.policyText}>{link.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.logoutRow}
              onPress={() => setShowLogoutModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text style={styles.logoutText}>Logout</Text>
              <Icon name="log-out-outline" size={18} color={colors.gold} />
            </Pressable>

            <Text style={styles.version}>App Version: {APP_VERSION}</Text>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to sign out? You&apos;ll need to sign in again to
              place an order.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                accessibilityRole="button"
                accessibilityLabel="Cancel sign out"
                accessibilityState={{ disabled: loggingOut }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <AnimatedPressable
                style={[styles.modalConfirmButton, loggingOut && styles.buttonDisabled]}
                onPress={handleLogout}
                disabled={loggingOut}
                accessibilityRole="button"
                accessibilityLabel="Confirm sign out"
                accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
              >
                {loggingOut ? (
                  <BrandLoader size="sm" color={colors.background} />
                ) : (
                  <Text style={styles.modalConfirmText}>Sign Out</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: spacing.xxl },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  bannerText: { flex: 1 },
  bannerName: { fontFamily: typography.serif, fontSize: 20, color: colors.charcoal },
  bannerContact: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.brownSoft,
  },
  bannerAction: { padding: spacing.xs },

  detailCard: {
    borderRadius: radius.lg,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.brownSoft,
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.charcoal,
  },

  actionCard: {
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  actionRowLast: { borderBottomWidth: 0 },
  actionIconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cream,
  },
  actionTextWrap: { flex: 1 },
  actionLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.charcoal,
  },
  actionCaption: {
    marginTop: 2,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },

  policyWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.lg,
  },
  policyItem: { width: "50%", paddingVertical: spacing.sm, paddingRight: spacing.sm },
  policyText: { fontFamily: typography.sans, fontSize: 13, color: colors.charcoal },

  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  logoutText: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.gold },
  version: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
  },

  card: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  emptyIconWrap: {
    width: 74,
    height: 74,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 20,
    color: colors.charcoal,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.brownSoft,
    textAlign: "center",
    lineHeight: 20,
  },
  primaryButton: {
    borderRadius: radius.md,
    marginTop: spacing.lg,
    backgroundColor: colors.charcoal,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.warmWhite,
    fontFamily: typography.sansMedium,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  secondaryButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.brownSoft,
    fontFamily: typography.sans,
    fontSize: 13,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.lg,
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  modalTitle: { fontFamily: typography.serif, fontSize: 22, color: colors.charcoal },
  modalMessage: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 14,
    color: colors.brownSoft,
    lineHeight: 20,
  },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  modalCancelButton: { flex: 1, paddingVertical: spacing.md, alignItems: "center" },
  modalCancelText: {
    fontFamily: typography.sans,
    fontSize: 14,
    color: colors.brownSoft,
  },
  modalConfirmButton: {
    borderRadius: radius.md,
    flex: 1,
    backgroundColor: colors.charcoal,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  modalConfirmText: {
    color: colors.warmWhite,
    fontFamily: typography.sansMedium,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  buttonDisabled: { opacity: 0.6 },
});
