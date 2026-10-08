import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRequest, ApiError } from "./api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RegisterDeviceResponse {
  success: boolean;
}

// ---------------------------------------------------------------------------
// State — prevents duplicate permission requests in the same session
// ---------------------------------------------------------------------------
let _tokenCache: string | null = null;

let notificationsModulePromise: Promise<typeof import("expo-notifications")> | null = null;

async function getNotificationsModule() {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications");
  }
  return notificationsModulePromise;
}

// ---------------------------------------------------------------------------
// Permission + Token
// ---------------------------------------------------------------------------

/**
 * Request notification permission and return the Expo push token.
 * Returns `null` if:
 *  - running in simulator/emulator
 *  - user denies permission
 *  - projectId not found
 *
 * Does NOT throw — callers check the return value.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (_tokenCache) return _tokenCache;

  if (Platform.OS === "web") {
    return null;
  }

  if (Constants.appOwnership === "expo") {
    console.warn("[push] Push notifications require a development build.");
    return null;
  }

  // Push only works on physical devices
  if (!Device.isDevice) {
    console.warn("[push] Must use a physical device for push notifications");
    return null;
  }

  // Check / request permission
  const Notifications = await getNotificationsModule();
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null; // caller can show toast
  }

  // Android channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF8A00",
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[push] No EAS projectId — cannot get push token");
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    _tokenCache = tokenData.data;
    return _tokenCache;
  } catch (err) {
    console.error("[push] Failed to get push token:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Device registration
// ---------------------------------------------------------------------------

/**
 * Register the device push token with the backend.
 * Requires authentication — pass the JWT token.
 *
 * Endpoint: POST /v1/notifications/register-device
 * Body: { token, platform }
 *
 * Retries once on transient failure. Returns true on success.
 */
export async function registerDeviceToken(
  authToken: string
): Promise<boolean> {
  const pushToken = await getExpoPushToken();
  if (!pushToken) return false;

  const body = {
    token: pushToken,
    platform: Platform.OS, // "ios" | "android"
  };

  try {
    await apiRequest<RegisterDeviceResponse>(
      "/v1/notifications/register-device",
      { method: "POST", body, token: authToken }
    );
    return true;
  } catch (err) {
    // Retry once for network errors
    if (err instanceof ApiError && err.isNetworkError) {
      try {
        await apiRequest<RegisterDeviceResponse>(
          "/v1/notifications/register-device",
          { method: "POST", body, token: authToken }
        );
        return true;
      } catch {
        // second attempt also failed — give up silently for now
      }
    }
    console.warn("[push] Device registration failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Notification presentation config
// ---------------------------------------------------------------------------

/** Configure how notifications appear when the app is in foreground. */
export async function configureForegroundPresentation() {
  const Notifications = await getNotificationsModule();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
