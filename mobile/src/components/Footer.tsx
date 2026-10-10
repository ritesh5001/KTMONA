import React from "react";
import { useRouter } from "expo-router";
import { Icon } from "./Icon";
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Text } from "../i18n/Text";
import { colors, spacing, typography, textStyles, radius } from "../theme";
import { companyInfo } from "../data/company";

const accordionSections = ["CATEGORIES", "SUPPORT", "QUICK LINKS", "OUR POLICIES"] as const;

type FooterSection = (typeof accordionSections)[number];

const sectionLinks: Record<FooterSection, { label: string; route?: string; onPress?: () => void }[]> = {
  CATEGORIES: [
    { label: "All Categories", route: "/categories" },
    { label: "Wedding Sherwani", route: "/search?q=wedding%20sherwani" },
    { label: "Indo Western", route: "/search?q=indo%20western" },
    { label: "Kurta Sets", route: "/search?q=kurta" },
  ],
  SUPPORT: [
    { label: "Open Support", route: "/contact" },
    { label: "Call Support" },
    { label: "Email Support" },
  ],
  "QUICK LINKS": [
    { label: "Home", route: "/home" },
    { label: "Marketplace", route: "/marketplace" },
    { label: "Wishlist", route: "/wishlist" },
    { label: "Your Orders", route: "/orders" },
  ],
  "OUR POLICIES": [
    { label: "Privacy Policy", route: "/privacy-policy" },
    { label: "Terms & Conditions", route: "/terms" },
    { label: "Return & Refund Policy", route: "/return-policy" },
    { label: "Refund Policy", route: "/refund-policy" },
    { label: "Shipping & Delivery Policy", route: "/shipping-policy" },
    { label: "Vendor Agreement", route: "/vendor-agreement" },
  ],
};

export function Footer() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [openSection, setOpenSection] = React.useState<string | null>(null);
  const [showSupportModal, setShowSupportModal] = React.useState(false);

  const openRoute = React.useCallback(
    (route: string) => {
      router.push(route as never);
    },
    [router]
  );

  const openDialer = React.useCallback(() => {
    Linking.openURL(`tel:${companyInfo.supportPhoneDial}`);
  }, []);

  const openEmail = React.useCallback(() => {
    Linking.openURL(`mailto:${companyInfo.supportEmail}`);
  }, []);

  const handleSectionAction = React.useCallback(
    (section: FooterSection, label: string, route?: string) => {
      if (section === "SUPPORT" && label === "Call Support") {
        openDialer();
        return;
      }
      if (section === "SUPPORT" && label === "Email Support") {
        openEmail();
        return;
      }
      if (route) {
        openRoute(route);
      }
    },
    [openDialer, openEmail, openRoute]
  );

  const handleNewsletterSubmit = React.useCallback(() => {
    if (!email.trim() || !email.includes("@")) {
      return;
    }
    setEmail("");
  }, [email]);

  return (
    <View style={styles.footer}>
      <Text style={styles.footerTitle}>STAY UPDATED</Text>
      <View style={styles.newsletterRow}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email Address"
          placeholderTextColor="#8D99B8"
          keyboardType="email-address"
          style={styles.newsletterInput}
        />
        <Pressable style={styles.newsletterArrowButton} onPress={handleNewsletterSubmit}>
          <Icon name="arrow-right" size={18} color={colors.white} />
        </Pressable>
      </View>

      <Pressable style={styles.supportPill} onPress={() => setShowSupportModal(true)}>
        <Icon name="headphones" size={16} color={colors.white} />
        <Text style={styles.supportPillText}>24x6 Support Concierge</Text>
      </Pressable>

      <View style={styles.accordionWrap}>
        {accordionSections.map((section) => {
          const isOpen = openSection === section;
          const links = sectionLinks[section];
          return (
            <View key={section}>
              <Pressable
                style={styles.accordionRow}
                onPress={() => setOpenSection(isOpen ? null : section)}
              >
                <Text style={styles.accordionTitle}>{section}</Text>
                <Icon name={isOpen ? "minus" : "plus"} size={16} color={colors.white} />
              </Pressable>
              {isOpen && (
                <View style={styles.accordionContent}>
                  {links.map((link) => (
                    <Pressable
                      key={link.label}
                      style={styles.linkRow}
                      onPress={() => handleSectionAction(section, link.label, link.route)}
                    >
                      <Text style={styles.accordionText}>{link.label}</Text>
                      <Icon name="chevron-right" size={14} color="#C3CCE3" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.contactBlock}>
        <Text style={styles.contactBrand}>KTMONA</Text>
        <Text style={styles.contactPrimary}>{companyInfo.supportPhoneDisplay}</Text>
        <Text style={styles.contactValue}>Support: {companyInfo.supportEmail}</Text>
        <Text style={styles.contactValue}>Onboarding: {companyInfo.onboardingEmail}</Text>
        <Text style={styles.contactValue}>Refunds: {companyInfo.refundEmail}</Text>
        <Text style={styles.contactHours}>{companyInfo.supportHours}</Text>
      </View>

      <Modal
        visible={showSupportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Support Concierge</Text>
            <Text style={styles.modalBody}>{companyInfo.supportPhoneDisplay}</Text>
            <Text style={styles.modalBody}>Support: {companyInfo.supportEmail}</Text>
            <Text style={styles.modalBody}>Onboarding: {companyInfo.onboardingEmail}</Text>
            <Text style={styles.modalBody}>Refunds: {companyInfo.refundEmail}</Text>
            <Text style={styles.modalBody}>{companyInfo.supportHours}</Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalButton} onPress={openDialer}>
                <Text style={styles.modalButtonText}>Call</Text>
              </Pressable>
              <Pressable style={styles.modalButton} onPress={openEmail}>
                <Text style={styles.modalButtonText}>Email</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonMuted]}
                onPress={() => {
                  setShowSupportModal(false);
                  openRoute("/contact");
                }}
              >
                <Text style={styles.modalButtonText}>Details</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setShowSupportModal(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <View>
        <Text style={styles.disclaimerText}>For order updates and support tickets, use your registered account details.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: spacing.xl,
    backgroundColor: colors.headerBrown,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  footerTitle: {
    fontFamily: typography.heading,
    fontSize: 18,
    color: colors.white,
    letterSpacing: 0.7,
  },
  newsletterRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#2A3D7A",
    borderRadius: radius.md,
    overflow: "hidden",
    alignItems: "center",
    backgroundColor: "#13245A",
  },
  newsletterInput: {
    flex: 1,
    color: colors.white,
    fontFamily: typography.body,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  newsletterArrowButton: {
    borderRadius: radius.md,
    width: 42,
    height: 42,
    borderLeftWidth: 1,
    borderLeftColor: "#2A3D7A",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16296A",
  },
  accordionWrap: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  accordionRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#1E3070",
    paddingVertical: spacing.sm,
  },
  accordionTitle: {
    ...textStyles.bodyText,
    color: colors.white,
    fontFamily: typography.bodyMedium,
    letterSpacing: 0.5,
  },
  accordionContent: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },
  accordionText: {
    ...textStyles.bodyText,
    color: "#C3CCE3",
  },
  supportPill: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "#3A4E8C",
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  supportPillText: {
    ...textStyles.bodyText,
    color: colors.white,
    fontFamily: typography.bodyMedium,
    letterSpacing: 0.4,
  },
  contactBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#1E3070",
    gap: 2,
  },
  contactBrand: {
    fontFamily: typography.bodyMedium,
    fontSize: 15,
    color: "#E8EDF8",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  contactPrimary: {
    fontFamily: typography.bodyMedium,
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
    lineHeight: 24,
  },
  contactValue: {
    fontFamily: typography.body,
    fontSize: 12,
    color: "#E8EDF8",
    lineHeight: 20,
    letterSpacing: 0.15,
  },
  contactHours: {
    fontFamily: typography.body,
    fontSize: 12,
    color: "#C3CCE3",
    lineHeight: 20,
    letterSpacing: 0.15,
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    backgroundColor: "#0A1638",
    borderWidth: 1,
    borderColor: "#2A3D7A",
    gap: spacing.xs,
  },
  modalTitle: {
    fontFamily: typography.heading,
    fontSize: 22,
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  modalBody: {
    fontFamily: typography.body,
    fontSize: 13,
    color: "#E8EDF8",
    lineHeight: 20,
  },
  modalActions: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#4A5E9C",
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modalButtonMuted: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  modalButtonText: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  closeText: {
    marginTop: spacing.md,
    alignSelf: "center",
    fontFamily: typography.body,
    fontSize: 12,
    color: "#C3CCE3",
  },
  disclaimerText: {
    marginTop: spacing.lg,
    fontFamily: typography.body,
    fontSize: 13,
    color: "#C3CCE3",
    lineHeight: 24,
    letterSpacing: 0.1,
  },
});
