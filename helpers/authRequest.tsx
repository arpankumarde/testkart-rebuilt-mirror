import superjson from "superjson";

/**
 * Shared POST client for the OTP send and verify endpoints. It gives every
 * request a timeout and turns each failure (offline, timeout, unreachable
 * server, rate limit, bad gateway HTML, Zod issue arrays) into one readable
 * AuthRequestError, so a form only has to show `error.message`.
 */

export const AUTH_REQUEST_TIMEOUT_MS = 20_000;

export type AuthRequestErrorKind =
  | "offline"
  | "timeout"
  | "network"
  | "rate_limited"
  | "verification"
  | "invalid"
  | "server";

export const AUTH_ERROR_MESSAGES = {
  offline: "You're offline. Check your internet connection and try again.",
  timeout: "The request timed out. Check your connection and try again.",
  network: "We couldn't reach Testkart. Check your internet connection and try again.",
  rateLimited: "Too many OTP requests. Please wait a moment and try again.",
  verification: "Security check failed. Please try again.",
  invalid: "Please check the details you entered and try again.",
  server: "Our server is temporarily unavailable. Please try again in a moment.",
} as const;

export class AuthRequestError extends Error {
  readonly kind: AuthRequestErrorKind;
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: AuthRequestErrorKind,
    message: string,
    options: { status?: number; retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = "AuthRequestError";
    this.kind = kind;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export const isBrowserOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

function messageFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  if (Array.isArray(error)) {
    const messages = error
      .map((issue) =>
        typeof issue === "string" ? issue : (issue as { message?: unknown })?.message
      )
      .filter((m): m is string => typeof m === "string" && m.trim().length > 0);
    if (messages.length > 0) return messages.join(" ");
  }
  return undefined;
}

function retryAfterFrom(payload: unknown, headers: Headers | undefined): number | undefined {
  const fromBody = (payload as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
  if (typeof fromBody === "number" && fromBody > 0) return Math.ceil(fromBody);
  const fromHeader = Number(headers?.get?.("Retry-After"));
  return Number.isFinite(fromHeader) && fromHeader > 0 ? Math.ceil(fromHeader) : undefined;
}

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return superjson.parse(text);
  } catch {
    return undefined;
  }
}

function errorForResponse(status: number, payload: unknown, headers: Headers | undefined) {
  const serverMessage = messageFromPayload(payload);
  if (status === 429) {
    return new AuthRequestError("rate_limited", serverMessage ?? AUTH_ERROR_MESSAGES.rateLimited, {
      status,
      retryAfterSeconds: retryAfterFrom(payload, headers),
    });
  }
  if (status === 403) {
    return new AuthRequestError("verification", serverMessage ?? AUTH_ERROR_MESSAGES.verification, {
      status,
    });
  }
  if (status >= 400 && status < 500) {
    return new AuthRequestError("invalid", serverMessage ?? AUTH_ERROR_MESSAGES.invalid, { status });
  }
  // A 500 from our own handlers carries a readable message; gateway errors
  // (502/503/504) come back as HTML or empty and get the generic text.
  const useServerMessage = status === 500 && serverMessage;
  return new AuthRequestError("server", useServerMessage ? serverMessage : AUTH_ERROR_MESSAGES.server, {
    status,
  });
}

export async function postAuthRequest<T>(
  url: string,
  body: unknown,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  if (isBrowserOffline()) {
    throw new AuthRequestError("offline", AUTH_ERROR_MESSAGES.offline);
  }

  const { timeoutMs = AUTH_REQUEST_TIMEOUT_MS, signal: callerSignal, ...rest } = init ?? {};
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", forwardAbort);

  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method: "POST",
      body: superjson.stringify(body),
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
    });
    text = await response.text();
  } catch (err) {
    if (timedOut) throw new AuthRequestError("timeout", AUTH_ERROR_MESSAGES.timeout);
    if (callerSignal?.aborted) throw err;
    throw new AuthRequestError(
      "network",
      isBrowserOffline() ? AUTH_ERROR_MESSAGES.offline : AUTH_ERROR_MESSAGES.network
    );
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", forwardAbort);
  }

  const payload = parseBody(text);
  if (!response.ok) {
    throw errorForResponse(response.status, payload, response.headers);
  }
  if (payload === undefined) {
    throw new AuthRequestError("server", AUTH_ERROR_MESSAGES.server, { status: response.status });
  }
  return payload as T;
}

/** Any thrown value as a message a person can act on. */
export function authErrorMessage(err: unknown): string {
  if (err instanceof AuthRequestError) return err.message;
  if (err instanceof Error && err.message && !/^[[{]/.test(err.message.trim())) {
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
