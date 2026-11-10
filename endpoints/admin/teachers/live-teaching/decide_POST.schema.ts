import { z } from "zod";
import superjson from "superjson";

export const schema = z
  .object({
    applicationId: z.string().uuid(),
    action: z.enum(["approve", "reject", "revoke"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.action === "approve" || (v.reason?.length ?? 0) >= 5, {
    message: "Give the teacher a reason of at least 5 characters.",
    path: ["reason"],
  });
export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true; emailed: boolean };

export const postAdminLiveTeachingDecide = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/teachers/live-teaching/decide`, {
    method: "POST",
    body: superjson.stringify(schema.parse(input)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};