import superjson from "superjson";
import type { GecIssue } from "./gecExamInput";

/** Thrown when the server rejects calendar content, carrying field-level issues for the form. */
export class GecValidationError extends Error {
  issues: GecIssue[];
  constructor(message: string, issues: GecIssue[]) {
    super(message);
    this.name = "GecValidationError";
    this.issues = issues;
  }
}

async function read<T>(result: Response): Promise<T> {
  const text = await result.text();
  if (!result.ok) {
    let body: { error?: string; issues?: GecIssue[] } = {};
    try {
      body = superjson.parse(text);
    } catch {
      throw new Error("The server did not respond properly. Please try again in a moment.");
    }
    if (body.issues?.length) throw new GecValidationError(body.error ?? "Some fields need attention", body.issues);
    throw new Error(body.error ?? "Request failed");
  }
  return superjson.parse<T>(text);
}

/** GET a calendar endpoint; undefined params are left out of the query string. */
export async function gecGet<T>(path: string, params: Record<string, string | number | boolean | undefined | null> = {}, init?: RequestInit) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  const result = await fetch(`/_api/${path}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return read<T>(result);
}

export async function gecPost<T>(path: string, body: unknown, init?: RequestInit) {
  const result = await fetch(`/_api/${path}`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return read<T>(result);
}
