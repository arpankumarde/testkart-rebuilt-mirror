import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  channel: z.literal("whatsapp"),
  granted: z.boolean(),
  source: z.enum(["onboarding_dialog", "profile"]).default("onboarding_dialog"),
});

export type InputType = z.input<typeof schema>;

export type OutputType = { whatsapp: "granted" | "declined" };

export const postStudentMarketingConsent = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/student/marketing-consent`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const parsed = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (parsed as object)) throw new Error((parsed as { error?: string }).error ?? "Could not save");
  return parsed as OutputType;
};