const GUMLET_API_URL = "https://api.gumlet.com/v1";
const REQUEST_TIMEOUT_MS = 20000;

export type GumletRequestError = Error & { status: number; code: string | null };

/**
 * Calls the Gumlet REST API with the project's GUMLET_API_KEY. Backend only.
 * A non-2xx response throws an Error carrying the HTTP status and Gumlet's
 * error code (for example "folder_name_exists") as status and code.
 */
export async function gumletRequest<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.GUMLET_API_KEY;
  if (!apiKey) throw new Error("GUMLET_API_KEY is not set.");

  const response = await fetch(`${GUMLET_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    let code: string | null = null;
    try {
      code = JSON.parse(text)?.error?.code ?? null;
    } catch {
      code = null;
    }
    const error = new Error(`Gumlet ${method} ${path} failed with ${response.status}: ${text.slice(0, 300)}`) as GumletRequestError;
    error.name = "GumletRequestError";
    error.status = response.status;
    error.code = code;
    throw error;
  }
  return (text ? JSON.parse(text) : {}) as T;
}
