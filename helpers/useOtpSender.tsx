import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TurnstileWidgetHandle } from "../components/TurnstileWidget";
import {
  AUTH_ERROR_MESSAGES,
  AuthRequestError,
  authErrorMessage,
  isBrowserOffline,
} from "./authRequest";

/** Matches COOLDOWN_SECONDS in helpers/otpRateLimit.tsx, so a resend is never refused. */
export const OTP_RESEND_COOLDOWN_SECONDS = 45;

const SECURITY_CHECK_FAILED =
  "We couldn't complete the security check. Check your connection and try again.";

export type OtpSendPhase = "idle" | "checking" | "sending";

/**
 * Request state for an OTP send, kept apart from input validation so the
 * network can only ever affect the send itself, never whether the button is
 * enabled.
 *
 * - One send at a time: a ref lock drops double taps before any state update.
 * - The phase always returns to idle in `finally`, whatever the outcome.
 * - The resend cooldown starts only after a successful send and counts down
 *   from an end time, so a throttled background tab does not stretch it.
 */
export function useOtpSender(turnstileRef: RefObject<TurnstileWidgetHandle | null>) {
  const [phase, setPhase] = useState<OtpSendPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => !isBrowserOffline());
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  // Cloudflare shows a visible challenge only to traffic it flags; the form
  // must then point the visitor at it instead of just spinning.
  const [challengeVisible, setChallengeVisible] = useState(false);

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setError((current) => (current === AUTH_ERROR_MESSAGES.offline ? null : current));
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (cooldownEndsAt === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining === 0) setCooldownEndsAt(null);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [cooldownEndsAt]);

  const startCooldown = useCallback((seconds: number) => {
    setCooldownSeconds(seconds);
    setCooldownEndsAt(Date.now() + seconds * 1000);
  }, []);

  /**
   * Gets a Turnstile token, then runs `request` with it. Resolves true when
   * the OTP went out. Never throws: failures land in `error`.
   */
  const send = useCallback(
    async (request: (turnstileToken: string | undefined) => Promise<unknown>) => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setError(null);
      setPhase("checking");

      let hadToken = false;
      try {
        if (isBrowserOffline()) {
          throw new AuthRequestError("offline", AUTH_ERROR_MESSAGES.offline);
        }
        const token = (await turnstileRef.current?.getToken()) ?? null;
        if (!mountedRef.current) return false;
        hadToken = token !== null;

        setPhase("sending");
        await request(token ?? undefined);
        if (!mountedRef.current) return false;
        startCooldown(OTP_RESEND_COOLDOWN_SECONDS);
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        if (err instanceof AuthRequestError) {
          if (err.kind === "verification" && !hadToken) {
            setError(SECURITY_CHECK_FAILED);
          } else {
            setError(err.message);
          }
          if (err.kind === "rate_limited" && err.retryAfterSeconds) {
            startCooldown(err.retryAfterSeconds);
          }
        } else {
          setError(authErrorMessage(err));
        }
        return false;
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setPhase("idle");
      }
    },
    [turnstileRef, startCooldown]
  );

  const turnstileProps = useMemo(
    () => ({
      onBeforeInteractive: () => setChallengeVisible(true),
      onAfterInteractive: () => setChallengeVisible(false),
      onVerify: () => setChallengeVisible(false),
      onError: () => setChallengeVisible(false),
    }),
    []
  );

  return {
    send,
    phase,
    isSending: phase !== "idle",
    /** True while a send is waiting on a visible challenge the visitor must solve. */
    awaitingChallenge: phase === "checking" && challengeVisible,
    challengeVisible,
    error,
    setError,
    isOnline,
    cooldownSeconds,
    turnstileProps,
  };
}
