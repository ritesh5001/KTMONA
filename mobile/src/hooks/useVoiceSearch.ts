import * as React from "react";
import type { ExpoSpeechRecognitionResultEvent } from "expo-speech-recognition";
import { translate } from "../i18n";

/**
 * Voice search (Meesho's mic button). Speech is recognised on the device in
 * Indian English or Hindi (following the app language); words appear as they
 * are heard and `onFinal` fires with the finished phrase.
 *
 * The native module only exists in development/production builds, not in
 * Expo Go, so it is loaded lazily and `available` is false without it.
 */
type SpeechModule = typeof import("expo-speech-recognition");

let speech: SpeechModule | null | undefined;
function loadSpeech(): SpeechModule | null {
  if (speech !== undefined) return speech;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    speech = require("expo-speech-recognition") as SpeechModule;
  } catch {
    speech = null;
  }
  return speech;
}

export function useVoiceSearch({
  lang,
  onPartial,
  onFinal,
  onError,
}: {
  lang: "en" | "hi";
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [listening, setListening] = React.useState(false);
  const mod = loadSpeech();
  const handlers = React.useRef({ onPartial, onFinal, onError });
  handlers.current = { onPartial, onFinal, onError };

  React.useEffect(() => {
    if (!mod) return;
    const { ExpoSpeechRecognitionModule } = mod;
    const subs = [
      ExpoSpeechRecognitionModule.addListener("start", () => setListening(true)),
      ExpoSpeechRecognitionModule.addListener("end", () => setListening(false)),
      ExpoSpeechRecognitionModule.addListener("result", (e: ExpoSpeechRecognitionResultEvent) => {
        const text = e.results[0]?.transcript?.trim() ?? "";
        if (!text) return;
        if (e.isFinal) handlers.current.onFinal(text);
        else handlers.current.onPartial(text);
      }),
      ExpoSpeechRecognitionModule.addListener("error", (e: { error: string }) => {
        setListening(false);
        if (e.error === "aborted") return;
        handlers.current.onError(
          e.error === "not-allowed"
            ? translate("Allow microphone access to search by voice.")
            : e.error === "no-speech" || e.error === "speech-timeout"
              ? translate("Didn't catch that. Tap the mic and try again.")
              : translate("Voice search isn't available right now.")
        );
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [mod]);

  const start = React.useCallback(async () => {
    if (!mod) {
      handlers.current.onError(translate("Voice search isn't available right now."));
      return;
    }
    const { ExpoSpeechRecognitionModule } = mod;
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      handlers.current.onError(translate("Allow microphone access to search by voice."));
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: lang === "hi" ? "hi-IN" : "en-IN",
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
    });
  }, [mod, lang]);

  const stop = React.useCallback(() => {
    mod?.ExpoSpeechRecognitionModule.stop();
  }, [mod]);

  return { available: Boolean(mod), listening, start, stop };
}
