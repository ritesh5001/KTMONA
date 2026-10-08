import React from "react";
import { Platform } from "react-native";

/**
 * Automatically read the OTP out of the incoming SMS (Android).
 *
 * Uses Google's SMS Retriever API via react-native-otp-verify. That API needs no
 * permission and shows no prompt — the OS hands our app only messages that end with
 * our own 11-character app hash, so we never gain access to the user's other SMS.
 * That is also the catch: the OTP message MUST contain the hash or nothing arrives.
 *
 * Requirements for zero-tap to work:
 *   1. the SMS body ends with the app's hash (see getSmsAppHash below), and
 *   2. the build includes this native module (an EAS dev/production build — it does
 *      not exist in Expo Go).
 *
 * Everything degrades quietly. On iOS, in Expo Go, in a build without the module, or
 * when the SMS has no hash, this hook simply never fires and the OTP field keeps its
 * normal one-tap autofill (`textContentType="oneTimeCode"` / `autoComplete="sms-otp"`).
 * It must never be the reason a user cannot sign in.
 */

type OtpVerifyModule = {
    startOtpListener: (handler: (message: string) => void) => Promise<{ remove: () => void }>;
    removeListener: () => void;
    getHash: () => Promise<string[]>;
};

/** Load the native module lazily so its absence is never a crash. */
function loadOtpVerify(): OtpVerifyModule | null {
    if (Platform.OS !== "android") return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require("react-native-otp-verify");
        const resolved = mod?.default ?? mod;
        if (typeof resolved?.startOtpListener !== "function") return null;
        return resolved as OtpVerifyModule;
    } catch {
        // Module not present in this build (Expo Go, or iOS-only build).
        return null;
    }
}

/** First run of `length` digits in the message body. */
function extractCode(message: string, length: number): string | null {
    const match = message.match(new RegExp(`\\b(\\d{${length}})\\b`)) ?? message.match(/(\d{4,8})/);
    return match?.[1] ?? null;
}

/**
 * Calls `onCode` once with the OTP found in the incoming SMS.
 *
 * @param onCode   receives the extracted digits
 * @param options.enabled  set false to stop listening (e.g. after a successful verify)
 * @param options.length   expected number of digits
 */
export function useSmsOtpAutofill(
    onCode: (code: string) => void,
    options?: { enabled?: boolean; length?: number },
): void {
    const enabled = options?.enabled ?? true;
    const length = options?.length ?? 6;

    // Keep the latest callback without re-subscribing the native listener.
    const onCodeRef = React.useRef(onCode);
    React.useEffect(() => {
        onCodeRef.current = onCode;
    }, [onCode]);

    React.useEffect(() => {
        if (!enabled) return;

        const otpVerify = loadOtpVerify();
        if (!otpVerify) return;

        let cancelled = false;
        let subscription: { remove: () => void } | null = null;

        void otpVerify
            .startOtpListener((message: string) => {
                if (cancelled || typeof message !== "string") return;
                const code = extractCode(message, length);
                if (code) onCodeRef.current(code);
            })
            .then((sub) => {
                if (cancelled) {
                    sub?.remove?.();
                    return;
                }
                subscription = sub;
            })
            .catch(() => {
                // Listener could not start (Play Services unavailable, etc.) — the
                // manual/one-tap path still works.
            });

        return () => {
            cancelled = true;
            try {
                subscription?.remove?.();
                otpVerify.removeListener();
            } catch {
                // Nothing to clean up.
            }
        };
    }, [enabled, length]);
}

/**
 * The app's 11-character SMS Retriever hash.
 *
 * This must be appended to the OTP message or the retriever never fires. It is
 * derived from the package name AND the signing key, so it differs between a debug
 * build and a Play-signed release — read it from the build you actually ship.
 *
 * Returns null on iOS or when the native module is unavailable.
 */
export async function getSmsAppHash(): Promise<string | null> {
    const otpVerify = loadOtpVerify();
    if (!otpVerify) return null;
    try {
        const hashes = await otpVerify.getHash();
        return hashes?.[0] ?? null;
    } catch {
        return null;
    }
}
