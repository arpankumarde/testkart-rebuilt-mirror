import { z } from "zod";
import superjson from "superjson";

/** Draft one sample recovery message with the autopilot's current AI provider, to check it works. */
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  text: string;
  provider: "deepseek" | "floot";
  model: string;
  ms: number;
  flootCredits: number | null;
};

export const postAdminAutopilotAiTest = async (body: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/autopilot/ai-test`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const parsed = superjson.parse<OutputType | { error: string; code?: string }>(await result.text());
  if (!result.ok || "error" in (parsed as object)) {
    const failure = parsed as { error?: string; code?: string };
    const error = new Error(failure.error ?? "The sample draft failed") as Error & { code?: string };
    error.code = failure.code;
    throw error;
  }
  return parsed as OutputType;
};