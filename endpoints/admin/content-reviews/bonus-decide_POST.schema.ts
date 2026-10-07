import { z } from "zod";
import superjson from "superjson";

export const schema = z
  .object({
    claimId: z.number().int().positive(),
    action: z.enum(["credit", "decline", "reverse"]),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.action === "credit" || (v.note && v.note.length > 0), {
    message: "Add a reason. The teacher sees it in the email.",
    path: ["note"],
  });

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: true; message: string };

export const postAdminBonusDecide = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/content-reviews/bonus-decide`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};