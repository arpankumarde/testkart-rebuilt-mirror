import { z } from "zod";
import superjson from "superjson";

/** Called by the Testkart app after sign-in (register) and on sign-out (remove: true). */
export const schema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]{10,200}\]$/),
  platform: z.enum(["android", "ios"]),
  remove: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { ok: true };

export const postStudentPushToken = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/student/push-token`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const parsed = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (parsed as object)) throw new Error((parsed as { error?: string }).error ?? "Could not save");
  return parsed as OutputType;
};