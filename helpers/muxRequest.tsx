const MUX_API_URL = "https://api.mux.com";
const REQUEST_TIMEOUT_MS = 20000;

export type MuxRequestError = Error & { status: number; type: string | null };

export function isMuxRequestError(error: unknown): error is MuxRequestError {
  return error instanceof Error && error.name === "MuxRequestError";
}

/** True once the Mux API token and a DRM configuration are set, which is what DRM pushes need. */
export function isMuxDrmConfigured(): boolean {
  return !!process.env.MUX_TOKEN_ID && !!process.env.MUX_TOKEN_SECRET && !!process.env.MUX_DRM_CONFIGURATION_ID;
}

/**
 * Calls the Mux REST API with the project's MUX_TOKEN_ID / MUX_TOKEN_SECRET. Backend only.
 * Returns the response's `data` field. A non-2xx response throws an Error carrying the
 * HTTP status and Mux's error type (for example "invalid_parameters").
 */
export async function muxRequest<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET are not set.");

  const response = await fetch(`${MUX_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    let type: string | null = null;
    let messages = "";
    try {
      const parsed = JSON.parse(text)?.error;
      type = parsed?.type ?? null;
      messages = Array.isArray(parsed?.messages) ? parsed.messages.join("; ") : "";
    } catch {
      type = null;
    }
    const error = new Error(
      `Mux ${method} ${path} failed with ${response.status}: ${messages || text.slice(0, 300)}`
    ) as MuxRequestError;
    error.name = "MuxRequestError";
    error.status = response.status;
    error.type = type;
    throw error;
  }
  return (text ? JSON.parse(text)?.data ?? {} : {}) as T;
}
