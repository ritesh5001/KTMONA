"use client";

import * as React from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* Minimal Web Speech API typing (not in TypeScript's DOM lib). */
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Microphone button for product search. Speaks → text via the browser's
 * built-in speech recognition (Chrome, Edge, Safari, Android). Hidden where
 * the browser has no speech recognition.
 *
 * `onInterim` receives the words as they are heard; `onResult` the final text.
 */
export function VoiceSearchButton({
  onResult,
  onInterim,
  className,
}: {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  className?: string;
}) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);

  React.useEffect(() => {
    setSupported(getRecognition() !== null);
    return () => recognitionRef.current?.abort();
  }, []);

  const start = () => {
    const Recognition = getRecognition();
    if (!Recognition) return;
    if (listening) {
      recognitionRef.current?.abort();
      return;
    }

    const recognition = new Recognition();
    // Indian English understands Hinglish product names ("cotton kurti",
    // "saree") far better than the en-US default.
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let finalText = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      onInterim?.((finalText + interim).trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("Allow microphone access in your browser to search by voice.");
      } else if (event.error === "no-speech") {
        toast.info("Didn't catch that. Tap the mic and try again.");
      } else if (event.error !== "aborted") {
        toast.error("Voice search isn't available right now.");
      }
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = finalText.trim();
      if (text) onResult(text);
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={start}
      aria-label={listening ? "Stop voice search" : "Search by voice"}
      title={listening ? "Listening… tap to stop" : "Search by voice"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
        listening ? "animate-pulse bg-brand text-ink" : "text-muted-foreground hover:bg-mist hover:text-foreground",
        className
      )}
    >
      <Mic className="h-4 w-4" aria-hidden />
    </button>
  );
}
