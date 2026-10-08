"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  API_ACTIVITY_EVENT,
  NAVIGATION_START_EVENT,
  type ApiActivityDetail,
} from "@/lib/navigation-feedback";

const COMPLETE_DELAY_MS = 170;
const FAILSAFE_TIMEOUT_MS = 10000;

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = React.useState(false);
  const [overlayVisible, setOverlayVisible] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [mode, setMode] = React.useState<"navigation" | "mutation">("navigation");
  const [message, setMessage] = React.useState("Preparing your next view");

  const completeTimeoutRef = React.useRef<number | null>(null);
  const failsafeRef = React.useRef<number | null>(null);
  const tickRef = React.useRef<number | null>(null);
  const overlayDelayRef = React.useRef<number | null>(null);
  const navigationPendingRef = React.useRef(false);
  const mutationCountRef = React.useRef(0);

  const clearTimers = React.useCallback(() => {
    if (completeTimeoutRef.current) {
      window.clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
    if (failsafeRef.current) {
      window.clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (overlayDelayRef.current) {
      window.clearTimeout(overlayDelayRef.current);
      overlayDelayRef.current = null;
    }
  }, []);

  const begin = React.useCallback(
    (nextMode: "navigation" | "mutation", nextMessage: string) => {
      clearTimers();
      setMode(nextMode);
      setMessage(nextMessage);
      setVisible(true);
      setOverlayVisible(false);
      setProgress(14);

      // Animate quickly to indicate immediate reaction, then crawl.
      window.requestAnimationFrame(() => setProgress(46));

      tickRef.current = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 88) return prev;
          return prev + 4;
        });
      }, 220);

      failsafeRef.current = window.setTimeout(() => {
        setVisible(false);
        setOverlayVisible(false);
        setProgress(0);
        navigationPendingRef.current = false;
        mutationCountRef.current = 0;
        clearTimers();
      }, FAILSAFE_TIMEOUT_MS);
    },
    [clearTimers]
  );

  const finish = React.useCallback(() => {
    setProgress(100);
    setOverlayVisible(false);
    clearTimers();
    completeTimeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, COMPLETE_DELAY_MS);
  }, [clearTimers]);

  const finishIfIdle = React.useCallback(() => {
    if (navigationPendingRef.current || mutationCountRef.current > 0) {
      return;
    }
    finish();
  }, [finish]);

  React.useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;

      const currentPath = `${window.location.pathname}${window.location.search}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      if (currentPath === nextPath) return;

      navigationPendingRef.current = true;
      begin("navigation", "Preparing your next view");
    };

    const onApiActivity = (event: Event) => {
      const detail = (event as CustomEvent<ApiActivityDetail>).detail;
      if (!detail) return;

      if (detail.type === "start") {
        mutationCountRef.current += 1;
        begin("mutation", detail.label ?? "Processing your request");
        return;
      }

      mutationCountRef.current = Math.max(0, mutationCountRef.current - 1);
      if (mutationCountRef.current > 0) {
        setMode("mutation");
        setMessage("Finishing your request");
        return;
      }

      if (navigationPendingRef.current) {
        setMode("navigation");
        setMessage("Preparing your next view");
        return;
      }

      finishIfIdle();
    };

    const onNavigationStart = () => {
      navigationPendingRef.current = true;
      begin("navigation", "Preparing your next view");
    };

    window.addEventListener("click", onClickCapture, true);
    window.addEventListener(NAVIGATION_START_EVENT, onNavigationStart);
    window.addEventListener(API_ACTIVITY_EVENT, onApiActivity as EventListener);

    return () => {
      window.removeEventListener("click", onClickCapture, true);
      window.removeEventListener(NAVIGATION_START_EVENT, onNavigationStart);
      window.removeEventListener(API_ACTIVITY_EVENT, onApiActivity as EventListener);
      clearTimers();
    };
  }, [begin, clearTimers, finishIfIdle]);

  React.useEffect(() => {
    if (navigationPendingRef.current) {
      navigationPendingRef.current = false;
      if (mutationCountRef.current > 0) {
        setMode("mutation");
        setMessage("Finishing your request");
        return;
      }
      finishIfIdle();
    }
    // Route/search change means navigation has completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed left-0 right-0 top-0 z-120 h-0.75 transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="h-full bg-brand shadow-[0_0_12px_rgba(255,138,0,0.55)] transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-110 transition-opacity duration-200 ${
          overlayVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-background/20 backdrop-blur-sm" />
        <div className="absolute left-1/2 top-1/2 w-[min(92vw,340px)] -translate-x-1/2 -translate-y-1/2 border border-border-soft bg-card/95 px-5 py-4 shadow-[0_10px_40px_rgba(12,27,66,0.14)]">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 rounded-full border-2 border-brand/25 border-t-brand animate-spin" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-brand-strong">
                {mode === "mutation" ? "Working" : "Please Wait"}
              </p>
              <p className="truncate text-sm text-foreground">{message}</p>
            </div>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden bg-mist dark:bg-navy/25">
            <div className="h-full w-1/2 animate-pulse bg-brand/70" />
          </div>
        </div>
      </div>
    </>
  );
}
