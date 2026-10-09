import * as React from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ProfileAvatar } from "../../components/ProfileAvatar";
import { useAuth } from "../../hooks/useAuth";
import { C } from "../theme";
import { HeaderActions, PrimaryBtn, T } from "../kit";

type Row = { icon: React.ComponentProps<typeof Feather>["name"]; label: string; href?: string; url?: string };

const SHOPPING: Row[] = [
  { icon: "package", label: "My Orders", href: "/orders" },
  { icon: "heart", label: "My Wishlist", href: "/wishlist" },
  { icon: "map-pin", label: "My Addresses", href: "/profile/addresses" },
  { icon: "bell", label: "Notifications", href: "/notifications" },
];
const HELP: Row[] = [
  { icon: "message-circle", label: "Help & Support", href: "/support" },
  { icon: "lock", label: "Change Password", href: "/forgot-password" },
  { icon: "briefcase", label: "Become a Seller", url: "https://www.ktmona.com/register/seller" },
];
const POLICIES: Row[] = [
  { icon: "file-text", label: "Terms & Conditions", href: "/terms" },
  { icon: "truck", label: "Shipping Policy", href: "/shipping-policy" },
  { icon: "rotate-ccw", label: "Return Policy", href: "/return-policy" },
  { icon: "credit-card", label: "Refund Policy", href: "/refund-policy" },
  { icon: "shield", label: "Privacy Policy", href: "/privacy-policy" },
  { icon: "users", label: "Vendor Agreement", href: "/vendor-agreement" },
  { icon: "phone", label: "Contact Us", href: "/contact" },
];

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const user = session?.user;

  const open = (r: Row) => {
    if (r.url) void Linking.openURL(r.url);
    else if (r.href) router.push(r.href as never);
  };
  const confirmLogout = () =>
    Alert.alert("Log out?", "You'll need to sign in again to see your orders and cart.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <T w="semibold" size={17}>Account</T>
        <HeaderActions showNotifications={false} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {user ? (
          <View style={styles.profile}>
            <ProfileAvatar size={56} editable />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T w="semibold" size={16} numberOfLines={1}>{(user as { fullName?: string }).fullName || "KTMONA Shopper"}</T>
              {user.phone ? <T size={12} color={C.muted}>{user.phone}</T> : null}
              {user.email ? <T size={12} color={C.muted} numberOfLines={1}>{user.email}</T> : null}
            </View>
          </View>
        ) : (
          <View style={[styles.profile, { flexDirection: "column", alignItems: "stretch" }]}>
            <T w="semibold" size={16}>Hello there!</T>
            <T size={13} color={C.muted} style={{ marginTop: 2 }}>Sign in to track orders, save your wishlist and check out faster.</T>
            <PrimaryBtn label="Sign Up / Log In" onPress={() => router.push("/login?returnTo=%2Fprofile")} style={{ marginTop: 12 }} />
          </View>
        )}

        <Section title="Shopping" rows={user ? SHOPPING : SHOPPING.slice(1, 2)} onPress={open} />
        <Section title="Help" rows={user ? HELP : HELP.filter((r) => r.label !== "Change Password")} onPress={open} />
        <Section title="Policies" rows={POLICIES} onPress={open} />

        {user ? (
          <Pressable onPress={confirmLogout} style={styles.logout}>
            <Feather name="log-out" size={18} color={C.red} />
            <T w="semibold" size={14} color={C.red} style={{ marginLeft: 8 }}>Log out</T>
          </Pressable>
        ) : null}
        <T size={11} color={C.faint} style={{ textAlign: "center", marginTop: 16 }}>KTMONA · Trust Every Click</T>
      </ScrollView>
    </View>
  );
}

function Section({ title, rows, onPress }: { title: string; rows: Row[]; onPress: (r: Row) => void }) {
  return (
    <View style={{ marginTop: 10, backgroundColor: C.card }}>
      <T w="semibold" size={12} color={C.muted} style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, letterSpacing: 0.5 }}>{title.toUpperCase()}</T>
      {rows.map((r, i) => (
        <Pressable key={r.label} onPress={() => onPress(r)} style={[styles.row, i > 0 && styles.rowBorder]}>
          <Feather name={r.icon} size={18} color={C.navy} />
          <T size={14} style={{ flex: 1, marginLeft: 12 }}>{r.label}</T>
          <Feather name={r.url ? "external-link" : "chevron-right"} size={16} color={C.faint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingBottom: 6, backgroundColor: C.card },
  profile: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, padding: 16, marginTop: 1 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.card, marginTop: 10, paddingVertical: 14 },
});
