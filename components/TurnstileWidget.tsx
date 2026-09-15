import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { CLOUDFLARE_TURNSTILE_SITE_KEY } from "../helpers/_publicConfigs";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
  }
}

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "before-interactive-callback"?: () => void;
  "after-interactive-callback"?: () => void;
  appearance?: "always" | "execute" | "interaction-only";
  theme?: "light" | "dark" | "auto";
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SCRIPT_ID = "cf-turnstile-script";
let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      // Script tag already present but possibly already loaded before this
      // listener was attached — poll briefly as a fallback.
      const checkInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  /**
   * Hard errors (network failure, challenge failed). Falls back to onExpire
   * when not supplied, which is how this component behaved before the callback
   * was split out.
   */
  onError?: () => void;
  /**
   * Fired when the widget is about to show a visible, interactive challenge.
   * The mobile bridge page (pages/app-turnstile.tsx) uses this to tell the
   * native app to grow its otherwise-hidden WebView so the challenge is
   * actually tappable.
   */
  onBeforeInteractive?: () => void;
  /** Fired when the interactive challenge is done and the widget can hide again. */
  onAfterInteractive?: () => void;
  theme?: "light" | "dark" | "auto";
  className?: string;
}

/**
 * Cloudflare Turnstile challenge widget — added to the mobile OTP
 * login/signup forms to stop the automated SMS-pumping abuse (large
 * rotating pool of numbers + IPs that stayed under per-number/per-IP rate
 * limits). "interaction-only" appearance means it renders invisibly and
 * only shows a visible challenge to traffic Cloudflare flags as suspicious
 * — most real users never see anything.
 *
 * Call `ref.current.reset()` after every send attempt (success or failure)
 * to get a fresh single-use token for the next send (including resends).
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  (
    {
      onVerify,
      onExpire,
      onError,
      onBeforeInteractive,
      onAfterInteractive,
      theme,
      className,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    const onErrorRef = useRef(onError);
    const onBeforeInteractiveRef = useRef(onBeforeInteractive);
    const onAfterInteractiveRef = useRef(onAfterInteractive);
    const themeRef = useRef(theme);
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
    onBeforeInteractiveRef.current = onBeforeInteractive;
    onAfterInteractiveRef.current = onAfterInteractive;
    themeRef.current = theme;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      let cancelled = false;

      loadTurnstileScript().then(() => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: CLOUDFLARE_TURNSTILE_SITE_KEY,
          appearance: "interaction-only",
          theme: themeRef.current ?? "auto",
          callback: (token: string) => onVerifyRef.current(token),
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => (onErrorRef.current ?? onExpireRef.current)?.(),
          "before-interactive-callback": () => onBeforeInteractiveRef.current?.(),
          "after-interactive-callback": () => onAfterInteractiveRef.current?.(),
        });
      });

      return () => {
        cancelled = true;
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={containerRef} className={className} />;
  }
);

TurnstileWidget.displayName = "TurnstileWidget";
