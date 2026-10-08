import * as React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AppText as Text } from "./AppText";
import { Icon } from "./Icon";
import { Image } from "./CompatImage";
import { colors, radius, typography } from "../theme/tokens";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../providers/ToastProvider";
import { impactLight, notifySuccess } from "../utils/haptics";
import { updateMyAvatar } from "../services/profile";
import {
  buildAvatarImageName,
  uploadAvatarImage,
  type ReviewImageAsset,
} from "../services/imagekit";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Generous enough to stay sharp on a 3x display without being wasteful. */
const MAX_AVATAR_BYTES = 6 * 1024 * 1024;

function mimeTypeFor(uri: string, fallback?: string | null): string {
  if (fallback) return fallback;
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

/**
 * The signed-in user's picture, with their initial as the fallback.
 *
 * Showing only an initial is fine as a default but poor as a permanent state —
 * it is the one place in the app that is meant to be *theirs*, and there was no
 * way to make it so. Tapping opens the library, uploads to the same ImageKit
 * bucket the rest of the app uses, and stores the resulting URL against the
 * profile.
 *
 * `editable` is off by default: the drawer and any other read-only surface show
 * the picture without inviting a change, and only the profile screen makes it
 * an affordance.
 */
export const ProfileAvatar = React.memo(function ProfileAvatar({
  size = 72,
  editable = false,
}: {
  size?: number;
  editable?: boolean;
}) {
  const { session, updateUser } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const user = session?.user;
  const avatar = user?.avatar ?? null;
  const initial = (user?.fullName ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

  const press = useSharedValue(0);
  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.04 * press.value }],
  }));

  const pickAndUpload = React.useCallback(async () => {
    if (busy) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast("Photo access is needed to set a picture", "info");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // Square crop up front, so the circle never lops off half a face.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const picked = result.assets[0];
    if (typeof picked.fileSize === "number" && picked.fileSize > MAX_AVATAR_BYTES) {
      showToast("That image is too large. Please pick one under 6 MB.", "error");
      return;
    }

    const asset: ReviewImageAsset = {
      uri: picked.uri,
      fileName: buildAvatarImageName(),
      mimeType: mimeTypeFor(picked.uri, picked.mimeType),
    };

    setBusy(true);
    try {
      const url = await uploadAvatarImage(asset);
      const profile = await updateMyAvatar(url);
      // Trust the server's copy rather than the URL we just sent — it is what
      // every other surface will read back.
      await updateUser({ avatar: profile.avatar });
      notifySuccess();
      showToast("Profile picture updated", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not update your picture",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }, [busy, showToast, updateUser]);

  const remove = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const profile = await updateMyAvatar(null);
      await updateUser({ avatar: profile.avatar });
      showToast("Profile picture removed", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not remove your picture",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }, [busy, showToast, updateUser]);

  const frame = (
    <Animated.View
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: size / 2 },
        editable && frameStyle,
      ]}
    >
      {avatar ? (
        <Image
          source={{ uri: avatar }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={180}
          width={size}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
      )}

      {busy ? (
        <View style={[styles.busyVeil, { borderRadius: size / 2 }]}>
          <ActivityIndicator size="small" color={colors.gold} />
        </View>
      ) : null}
    </Animated.View>
  );

  if (!editable) return frame;

  return (
    <View>
      <AnimatedPressable
        onPress={() => {
          impactLight();
          void pickAndUpload();
        }}
        onPressIn={() => {
          press.value = withTiming(1, { duration: 110 });
        }}
        onPressOut={() => {
          press.value = withSpring(0, { damping: 17, stiffness: 230, mass: 0.65 });
        }}
        disabled={busy}
        hitSlop={8}
      >
        {frame}
        {/* A small mark rather than an overlay: the picture stays the subject. */}
        <View style={styles.editMark}>
          <Icon name="camera-outline" size={13} color={colors.background} />
        </View>
      </AnimatedPressable>

      {avatar && !busy ? (
        <Pressable onPress={() => void remove()} hitSlop={8} style={styles.removeButton}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(196, 167, 108, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(196, 167, 108, 0.4)",
  },
  initial: {
    fontFamily: typography.serif,
    color: colors.gold,
  },
  busyVeil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250, 247, 242, 0.72)",
  },
  editMark: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.background,
  },
  removeButton: {
    marginTop: 10,
    alignSelf: "center",
  },
  removeText: {
    fontFamily: typography.sans,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.brownSoft,
  },
});
