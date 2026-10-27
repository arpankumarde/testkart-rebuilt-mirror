import { ZodError } from "zod";

export const AI_PROMPT_MIN_LENGTH = 5;

export const AI_PROMPT_MESSAGES = {
  empty: "Please enter a prompt to continue.",
  tooShort: `Your prompt is too short. Please enter at least ${AI_PROMPT_MIN_LENGTH} characters.`,
  requestFailed: "We couldn't generate your asset right now. Please try again.",
  unexpected: "Something went wrong while generating your asset. Please try again.",
} as const;

const PROMPT_FIELDS = new Set(["prompt", "customPrompt"]);

/**
 * Returns the message to show under a prompt input, or null when the prompt is fine.
 * An optional prompt may be left blank, but if anything is typed it must meet the minimum.
 */
export function validateAiPrompt(
  value: string | null | undefined,
  options: { required?: boolean } = {}
): string | null {
  const required = options.required ?? true;
  const trimmed = (value ?? "").trim();
  if (!trimmed) return required ? AI_PROMPT_MESSAGES.empty : null;
  if (trimmed.length < AI_PROMPT_MIN_LENGTH) return AI_PROMPT_MESSAGES.tooShort;
  return null;
}

const TECHNICAL_TEXT =
  /deepseek|openai|api key|\bapi\b|json|stack|status ?code|statustext|undefined|null|econn|etimedout|failed to fetch|networkerror|load failed|zod|syntaxerror|unexpected token|internal server|gateway|\bat\s+\S+\s+\(/i;

function isReadableMessage(message: unknown): message is string {
  if (typeof message !== "string") return false;
  const text = message.trim();
  if (!text || text.length > 300) return false;
  if (/^[[{<]/.test(text)) return false;
  return !TECHNICAL_TEXT.test(text);
}

type IssueLike = { code?: unknown; path?: unknown; message?: unknown };

function messageFromIssues(issues: IssueLike[]): string {
  const issue = issues[0];
  if (!issue) return AI_PROMPT_MESSAGES.unexpected;
  const path = Array.isArray(issue.path) ? issue.path : [];
  const field = path[path.length - 1];
  if (typeof field === "string" && PROMPT_FIELDS.has(field)) {
    return issue.code === "too_small" ? AI_PROMPT_MESSAGES.tooShort : AI_PROMPT_MESSAGES.empty;
  }
  return isReadableMessage(issue.message) ? issue.message : AI_PROMPT_MESSAGES.unexpected;
}

function parseSerializedIssues(message: string): IssueLike[] | null {
  const text = message.trim();
  if (!text.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((item) => item && typeof item === "object" && "message" in item)
    ) {
      return parsed as IssueLike[];
    }
  } catch {
    return null;
  }
  return null;
}

/** Turns any error from an AI generation call into a sentence that is safe to show a user. */
export function getAiErrorMessage(error: unknown): string {
  if (error instanceof ZodError) return messageFromIssues(error.issues);
  if (error instanceof Error) {
    const issues = parseSerializedIssues(error.message);
    if (issues) return messageFromIssues(issues);
    if (error instanceof TypeError && !/fetch|network|load failed/i.test(error.message)) {
      return AI_PROMPT_MESSAGES.unexpected;
    }
    if (isReadableMessage(error.message)) return error.message.trim();
    return AI_PROMPT_MESSAGES.requestFailed;
  }
  if (isReadableMessage(error)) return error.trim();
  return AI_PROMPT_MESSAGES.unexpected;
}

/** Reads `{ error, code }` from a failed response body, whatever shape the server or a gateway sent. */
export function readAiErrorPayload(
  text: string,
  parse: (raw: string) => unknown
): { message: string; code?: string } {
  let payload: unknown = null;
  try {
    payload = parse(text);
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== "object") {
    return { message: AI_PROMPT_MESSAGES.requestFailed };
  }
  const { error, code } = payload as { error?: unknown; code?: unknown };
  let message: string = AI_PROMPT_MESSAGES.requestFailed;
  if (typeof error === "string") {
    message = error;
  } else if (Array.isArray(error)) {
    message = messageFromIssues(error as IssueLike[]);
  }
  return { message, code: typeof code === "string" ? code : undefined };
}

/** Server side: a ZodError from parsing a generation request, phrased for the user. */
export function aiValidationMessage(error: ZodError): string {
  return messageFromIssues(error.issues);
}
