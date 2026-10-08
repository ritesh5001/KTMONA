import PhonePePaymentSDK from "react-native-phonepe-pg";

/**
 * Native PhonePe checkout.
 *
 * PhonePe withdrew support for opening their hosted checkout page in a WebView
 * or browser from inside a mobile app. The old flow — `Linking.openURL(...)` on
 * a redirectUrl — now fails on PhonePe's own domain with a generic "Something
 * went wrong", after the buyer has already committed to paying. Apps must use
 * the native SDK.
 *
 * The exchange is simpler than the redirect flow it replaces: the backend
 * creates an SDK order and returns a token, the SDK is handed that token, and it
 * resolves with the outcome directly. There is no browser hop to detect a return
 * from, and no polling needed to discover what happened — though the server is
 * still the authority on whether money actually moved.
 */

export type PhonePeSdkStatus = "SUCCESS" | "FAILURE" | "INTERRUPTED";

export interface PhonePeSdkResult {
  status: PhonePeSdkStatus;
  error?: string;
}

/** iOS returns control to the app through its URL scheme; see app.json. */
const APP_SCHEME = "mobile";

/**
 * Prepare the SDK.
 *
 * Must be called before `startPhonePeTransaction`, and is safe to call again —
 * the SDK tolerates repeat initialisation, and re-initialising per checkout
 * avoids depending on app-launch ordering.
 *
 * `flowId` is PhonePe's correlation id for support tickets: passing the buyer's
 * own id means a failed payment can be traced to a person rather than a
 * timestamp.
 */
export async function initPhonePe(options: {
  merchantId: string;
  environment: string;
  flowId: string;
}): Promise<void> {
  const environment =
    options.environment === "SANDBOX" ? "SANDBOX" : "PRODUCTION";

  // The SDK requires an alphanumeric flowId with no special characters.
  const flowId = options.flowId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) || "guest";

  const ok = await PhonePePaymentSDK.init(
    environment,
    options.merchantId,
    flowId,
    // Logging off in production: the SDK is verbose and its logs can contain
    // order identifiers.
    environment === "SANDBOX"
  );

  // Android rejects bad arguments by throwing; iOS resolves false instead, so
  // both have to be treated as failure or startTransaction fails obscurely.
  if (ok === false) {
    throw new Error(
      "Could not start the payment provider. Please try again in a moment."
    );
  }
}

/**
 * Open PhonePe's checkout and wait for the buyer to finish.
 *
 * The request is a JSON *string*, not base64. The package README says to encode
 * it, but the shipped type definitions and the SDK source do no decoding, and
 * PhonePe's own integration guide passes `jsonEncode(payload)` directly —
 * base64 here produces an opaque failure.
 */
export async function startPhonePeTransaction(options: {
  phonepeOrderId: string;
  merchantId: string;
  token: string;
}): Promise<PhonePeSdkResult> {
  const request = JSON.stringify({
    orderId: options.phonepeOrderId,
    merchantId: options.merchantId,
    token: options.token,
    paymentMode: { type: "PAY_PAGE" },
  });

  const result = await PhonePePaymentSDK.startTransaction(request, APP_SCHEME);

  // The bridge returns a plain map; normalise it so callers can switch on it.
  const status = String(result?.status ?? "").toUpperCase();
  if (status === "SUCCESS" || status === "FAILURE" || status === "INTERRUPTED") {
    return { status, error: result?.error };
  }

  // An unrecognised status is not a success. Treating it as one would tell a
  // buyer their order was placed when nothing was charged.
  return {
    status: "INTERRUPTED",
    error: result?.error ?? `Unexpected payment status: ${status || "none"}`,
  };
}
