import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

/** null: the student has not been asked yet. */
export type OutputType = { whatsapp: "granted" | "declined" | null };

export const getStudentMarketingConsent = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/student/marketing-consent`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (body as object)) throw new Error((body as { error?: string }).error ?? "Could not load");
  return body as OutputType;
};