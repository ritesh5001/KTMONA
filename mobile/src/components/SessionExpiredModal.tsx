import * as React from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { Icon } from "./Icon";

/** Gives an expired authenticated session an explicit, recoverable next step. */
export function SessionExpiredModal() {
  const router = useRouter();
  const { sessionExpired, acknowledgeSessionExpired } = useAuth();
  const signInButtonRef = React.useRef<React.ElementRef<typeof Pressable>>(null);

  const continueToSignIn = React.useCallback(() => {
    acknowledgeSessionExpired();
    router.replace("/login");
  }, [acknowledgeSessionExpired, router]);

  const handleShow = React.useCallback(() => {
    AccessibilityInfo.announceForAccessibility(
      "Your session expired. Please sign in again."
    );
    requestAnimationFrame(() => {
      const node = findNodeHandle(signInButtonRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, []);

  return (
    <Modal
      visible={sessionExpired}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={continueToSignIn}
      onShow={handleShow}
    >
      <View
        style={styles.overlay}
        accessibilityViewIsModal
        accessibilityLabel="Session expired"
      >
        <View style={styles.card}>
          <View style={styles.iconWrap} accessibilityElementsHidden>
            <Icon name="lock-closed-outline" size={24} color={colors.interactive} />
          </View>
          <Text style={styles.eyebrow}>Account security</Text>
          <Text style={styles.title} accessibilityRole="header">
            Please sign in again
          </Text>
          <Text style={styles.body}>
            Your session ended to keep your account secure. Your bag and saved
            items will be available after you sign in.
          </Text>
          <Pressable
            ref={signInButtonRef}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={continueToSignIn}
            accessibilityRole="button"
            accessibilityLabel="Continue to sign in"
          >
            <Text style={styles.buttonText}>Continue to sign in</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.overlay,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 26,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  eyebrow: {
    marginTop: spacing.md,
    fontFamily: typography.sansMedium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.interactive,
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: typography.serif,
    fontSize: 27,
    lineHeight: 32,
    color: colors.charcoal,
    textAlign: "center",
  },
  body: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.brownSoft,
    textAlign: "center",
  },
  button: {
    width: "100%",
    minHeight: 48,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.interactive,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.onAccent,
  },
});
