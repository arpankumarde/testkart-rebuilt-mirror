import React, { useEffect, useRef } from "react";
import { TurnstileWidget, TurnstileWidgetHandle } from "../components/TurnstileWidget";
import styles from "./app-turnstile.module.css";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    __tkTurnstileReset?: () => void;
  }
}

type BridgeMessage =
  | { type: "ready" }
  | { type: "token"; token: string }
  | { type: "expired" }
  | { type: "error" }
  | { type: "interactive"; visible: boolean };

const post = (message: BridgeMessage) => {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
};

/**
 * Headless Turnstile host for the Testkart mobile app.
 *
 * Cloudflare ships no native Turnstile SDK, so the app loads this route in a
 * hidden WebView and reads the token off postMessage. Hosting it here rather
 * than as inline HTML in the app matters: Turnstile validates the document
 * hostname against the widget's configured hostname list, and inline HTML in a
 * WebView is served from about:blank. See
 * testkart-app/docs/turnstile-implementation.md.
 *
 * Not linked from anywhere in the site - it exists purely as a bridge, and
 * has no pageLayout so no site chrome is rendered around the challenge.
 */
export default function AppTurnstilePage() {
  const widgetRef = useRef<TurnstileWidgetHandle>(null);
  // "auto" follows the WebView's prefers-color-scheme, which already tracks the
  // device theme. An explicit ?theme= is still honoured, but the app no longer
  // sends one: a per-theme query string meant two CDN cache keys for one page,
  // and reloaded the WebView when the app's colour scheme resolved after mount.
  const themeParam =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("theme");
  const theme = themeParam === "dark" || themeParam === "light" ? themeParam : "auto";

  useEffect(() => {
    // The native side calls this through injectJavaScript when a send needs a
    // new single-use token: current app builds once the last token is spent,
    // older builds after every send attempt.
    window.__tkTurnstileReset = () => widgetRef.current?.reset();
    post({ type: "ready" });
    return () => {
      delete window.__tkTurnstileReset;
    };
  }, []);

  return (
    <div className={styles.root}>
      <TurnstileWidget
        ref={widgetRef}
        theme={theme}
        // Released app builds wait for an expired token to refresh by itself.
        refreshExpired="auto"
        onVerify={(token) => post({ type: "token", token })}
        onExpire={() => post({ type: "expired" })}
        onError={() => post({ type: "error" })}
        onBeforeInteractive={() => post({ type: "interactive", visible: true })}
        onAfterInteractive={() => post({ type: "interactive", visible: false })}
      />
    </div>
  );
}
