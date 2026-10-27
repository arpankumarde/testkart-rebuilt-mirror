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
  "refresh-expired"?: "auto" | "manual" | "never";
  appearance?: "always" | "execute" | "interaction-only";
  theme?: "light" | "dark" | "auto";
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_LOAD_TIMEOUT_MS = 15_000;
let scriptLoadPromise: Promise<void> | null = null;

/**
 * Loads the Turnstile script once. Rejects on a network error or after
 * SCRIPT_LOAD_TIMEOUT_MS, and forgets the failed attempt so the next send can
 * try again instead of waiting on a promise that never settles.
 */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (poll) clearInterval(poll);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(
      () => finish(new Error("Turnstile script load timed out")),
      SCRIPT_LOAD_TIMEOUT_MS
    );

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => finish());
    script.addEventListener("error", () => finish(new Error("Turnstile script failed to load")));
    // The tag may have loaded before these listeners were attached.
    poll = setInterval(() => {
      if (window.turnstile) finish();
    }, 100);
  }).catch((error: unknown) => {
    scriptLoadPromise = null;
    if (!window.turnstile) document.getElementById(SCRIPT_ID)?.remove();
    throw error;
  });

  return scriptLoadPromise;
}

/** Tokens are valid for 300 s. Stop handing one out a little before that. */
const TOKEN_MAX_AGE_MS = 270_000;

type HeldToken = { value: string; mintedAt: number };

const isFresh = (held: HeldToken | null): held is HeldToken =>
  held !== null && Date.now() - held.mintedAt < TOKEN_MAX_AGE_MS;

/**
 * How long getToken() waits for an invisible challenge before resolving null,
 * so a stalled check can never hold a send open. The wait is extended while a
 * visible challenge is on screen, since the visitor is solving it.
 */
export const TURNSTILE_TOKEN_WAIT_MS = 20_000;
/** Upper bound on that extension, so an abandoned or broken challenge still ends. */
export const TURNSTILE_INTERACTIVE_MAX_WAIT_MS = 180_000;

// An unspent token from a widget that unmounted, for example when the login
// page swaps the mobile form for the email form. The next widget to mount
// adopts it instead of challenging the visitor again.
let leftoverToken: HeldToken | null = null;

export interface TurnstileWidgetHandle {
  /**
   * Re-runs the challenge. The mobile app drives its bridge page
   * (pages/app-turnstile.tsx) this way; forms use getToken() instead.
   */
  reset: () => void;
  /**
   * Resolves with a single-use token for one send, or null if the challenge
   * errors, the script cannot load, or no token arrives within
   * TURNSTILE_TOKEN_WAIT_MS. Hands over the token already minted when there is one and only
   * runs a new challenge once that token has been spent, so a visitor who
   * passed the check is not challenged again until they ask for another send.
   */
  getToken: () => Promise<string | null>;
}

interface TurnstileWidgetProps {
  /** Fired for every minted token, including one adopted from an earlier widget. */
  onVerify?: (token: string) => void;
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
  /**
   * What happens when a token expires unused. Defaults to "never": getToken()
   * mints a fresh token on demand, and an automatic refresh would put a
   * checkbox in front of a flagged visitor who has not asked for anything. The
   * app bridge passes "auto" because released app builds rely on it.
   */
  refreshExpired?: "auto" | "never";
  theme?: "light" | "dark" | "auto";
  className?: string;
}

/**
 * Cloudflare Turnstile challenge widget for the mobile and email OTP
 * login/signup forms, added to stop automated OTP pumping (a large rotating
 * pool of numbers and IPs that stayed under the per-number/per-IP rate
 * limits). "interaction-only" appearance means it renders invisibly and only
 * shows a visible challenge to traffic Cloudflare flags as suspicious - most
 * real users never see anything.
 *
 * Tokens are single-use. Await `ref.current.getToken()` right before each send
 * and do not reset the widget afterwards: resetting after every send put a
 * second checkbox under the OTP field for visitors who had already passed.
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  (
    {
      onVerify,
      onExpire,
      onError,
      onBeforeInteractive,
      onAfterInteractive,
      refreshExpired = "never",
      theme,
      className,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const mountedRef = useRef(false);
    const renderStartedRef = useRef(false);
    // True from render or reset until the widget reports a token, error or expiry.
    const runningRef = useRef(false);
    const tokenRef = useRef<HeldToken | null>(null);
    // True while Cloudflare shows a visible challenge the visitor has to solve.
    const interactiveRef = useRef(false);
    const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const waiterRef = useRef<{
      promise: Promise<string | null>;
      resolve: (token: string | null) => void;
    } | null>(null);
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    const onErrorRef = useRef(onError);
    const onBeforeInteractiveRef = useRef(onBeforeInteractive);
    const onAfterInteractiveRef = useRef(onAfterInteractive);
    const refreshExpiredRef = useRef(refreshExpired);
    const themeRef = useRef(theme);
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
    onBeforeInteractiveRef.current = onBeforeInteractive;
    onAfterInteractiveRef.current = onAfterInteractive;
    refreshExpiredRef.current = refreshExpired;
    themeRef.current = theme;

    const clearWaitTimer = () => {
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    };

    const settleWaiter = (token: string | null) => {
      const waiter = waiterRef.current;
      if (!waiter) return false;
      waiterRef.current = null;
      clearWaitTimer();
      waiter.resolve(token);
      return true;
    };

    const armWaitTimer = (startedAt = Date.now()) => {
      clearWaitTimer();
      waitTimerRef.current = setTimeout(() => {
        const withinLimit = Date.now() - startedAt < TURNSTILE_INTERACTIVE_MAX_WAIT_MS;
        if (interactiveRef.current && withinLimit) armWaitTimer(startedAt);
        else settleWaiter(null);
      }, TURNSTILE_TOKEN_WAIT_MS);
    };

    const failRender = () => {
      renderStartedRef.current = false;
      runningRef.current = false;
      interactiveRef.current = false;
      settleWaiter(null);
      if (mountedRef.current) (onErrorRef.current ?? onExpireRef.current)?.();
    };

    const renderWidget = () => {
      if (renderStartedRef.current) return;
      renderStartedRef.current = true;
      runningRef.current = true;

      loadTurnstileScript()
        .then(() => {
          if (
            !mountedRef.current ||
            !containerRef.current ||
            !window.turnstile ||
            widgetIdRef.current
          ) {
            return;
          }

          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: CLOUDFLARE_TURNSTILE_SITE_KEY,
            appearance: "interaction-only",
            theme: themeRef.current ?? "auto",
            "refresh-expired": refreshExpiredRef.current,
            callback: (token: string) => {
              runningRef.current = false;
              interactiveRef.current = false;
              if (!settleWaiter(token)) {
                tokenRef.current = { value: token, mintedAt: Date.now() };
              }
              onVerifyRef.current?.(token);
            },
            "expired-callback": () => {
              tokenRef.current = null;
              runningRef.current = refreshExpiredRef.current === "auto";
              onExpireRef.current?.();
            },
            "error-callback": () => {
              tokenRef.current = null;
              runningRef.current = false;
              interactiveRef.current = false;
              settleWaiter(null);
              (onErrorRef.current ?? onExpireRef.current)?.();
            },
            "before-interactive-callback": () => {
              interactiveRef.current = true;
              onBeforeInteractiveRef.current?.();
            },
            "after-interactive-callback": () => {
              interactiveRef.current = false;
              onAfterInteractiveRef.current?.();
            },
          });
        })
        .catch(failRender);
    };

    const rerunChallenge = () => {
      if (!renderStartedRef.current) {
        renderWidget();
      } else if (!runningRef.current && window.turnstile && widgetIdRef.current) {
        runningRef.current = true;
        window.turnstile.reset(widgetIdRef.current);
      }
    };

    useImperativeHandle(ref, () => ({
      reset: () => {
        tokenRef.current = null;
        runningRef.current = false;
        rerunChallenge();
      },
      getToken: () => {
        const held = tokenRef.current;
        tokenRef.current = null;
        if (isFresh(held)) return Promise.resolve(held.value);
        if (waiterRef.current) return waiterRef.current.promise;

        let resolve!: (token: string | null) => void;
        const promise = new Promise<string | null>((r) => {
          resolve = r;
        });
        waiterRef.current = { promise, resolve };
        armWaitTimer();
        rerunChallenge();
        return promise;
      },
    }));

    useEffect(() => {
      mountedRef.current = true;
      const adopted = leftoverToken;
      leftoverToken = null;
      if (isFresh(adopted)) {
        tokenRef.current = adopted;
        onVerifyRef.current?.(adopted.value);
      } else {
        renderWidget();
      }

      return () => {
        mountedRef.current = false;
        renderStartedRef.current = false;
        runningRef.current = false;
        interactiveRef.current = false;
        settleWaiter(null);
        if (isFresh(tokenRef.current)) leftoverToken = tokenRef.current;
        tokenRef.current = null;
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