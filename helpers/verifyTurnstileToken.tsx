const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 8_000;

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export type TurnstileCheckResult =
  | { status: "valid" }
  /**
   * reason: "missing" (no token sent), "expired_or_reused" (Cloudflare's
   * timeout-or-duplicate), "unreachable" (siteverify did not answer) or
   * "rejected" (any other refusal).
   */
  | { status: "invalid"; reason: "missing" | "expired_or_reused" | "unreachable" | "rejected" }
  // The secret key hasn't been configured yet (TURNSTILE_SECRET_KEY unset).
  // The OTP send endpoints skip enforcement on this; the content report
  // endpoint refuses instead, since its check is mandatory.
  | { status: "not_configured" };

/**
 * Verifies a Cloudflare Turnstile token against Cloudflare's siteverify API.
 * Added to stop the SMS-OTP-pumping abuse (see helpers/otpRateLimit.tsx for
 * the earlier per-number/per-IP defense, which this supplements — that
 * defense alone couldn't stop an attacker spreading requests across
 * hundreds of distinct numbers/IPs).
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileCheckResult> {
  // Cast: the env var only appears in the generated process.env type once
  // the TURNSTILE_SECRET_KEY credential is connected via request_external_resource
  // (the matching public site key is CLOUDFLARE_TURNSTILE_SITE_KEY in the
  // generated helpers/_publicConfigs.tsx).
  const secretKey = (process.env as Record<string, string | undefined>).TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.warn(
      "TURNSTILE_SECRET_KEY is not configured — skipping Turnstile verification. " +
        "Set it up via Cloudflare Turnstile to enable this anti-abuse check."
    );
    return { status: "not_configured" };
  }

  if (!token) {
    return { status: "invalid", reason: "missing" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    // Bounded so a slow siteverify answers the caller with a clear 403 well
    // inside the web client's 20 s request timeout instead of hanging.
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("Turnstile siteverify request failed with status", response.status);
      return { status: "invalid", reason: "unreachable" };
    }

    const result = (await response.json()) as TurnstileVerifyResponse;
    if (!result.success) {
      console.warn("Turnstile verification rejected:", result["error-codes"]);
      const reused = result["error-codes"]?.includes("timeout-or-duplicate");
      return { status: "invalid", reason: reused ? "expired_or_reused" : "rejected" };
    }

    return { status: "valid" };
  } catch (error) {
    console.error("Error verifying Turnstile token:", error);
    return { status: "invalid", reason: "unreachable" };
  }
}
