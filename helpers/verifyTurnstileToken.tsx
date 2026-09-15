const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export type TurnstileCheckResult =
  | { status: "valid" }
  | { status: "invalid" }
  // The secret key hasn't been configured yet (TURNSTILE_SECRET_KEY unset).
  // Callers should treat this as "skip enforcement" rather than blocking
  // every OTP send on a misconfiguration — see send-otp endpoints for how
  // this is used.
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
    return { status: "invalid" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      console.error("Turnstile siteverify request failed with status", response.status);
      return { status: "invalid" };
    }

    const result = (await response.json()) as TurnstileVerifyResponse;
    if (!result.success) {
      console.warn("Turnstile verification rejected:", result["error-codes"]);
      return { status: "invalid" };
    }

    return { status: "valid" };
  } catch (error) {
    console.error("Error verifying Turnstile token:", error);
    return { status: "invalid" };
  }
}
