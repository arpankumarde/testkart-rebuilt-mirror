import superjson from "superjson";

/** Client-side caller shared by the admin/spin-win endpoint schemas. GET without a body, POST with one. */
export async function spinAdminFetch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const result = await fetch(`/_api/admin/spin-win/${path}`, {
    method: body === undefined ? "GET" : "POST",
    ...init,
    body: body === undefined ? undefined : superjson.stringify(body),
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const text = await result.text();
    let message = "Request failed";
    try {
      message = superjson.parse<{ error: string }>(text).error ?? message;
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new Error(message);
  }
  return superjson.parse<T>(await result.text());
}

export function spinQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
