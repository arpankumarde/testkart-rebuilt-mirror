import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  subscriptionId: z.number().int().positive(),
  adminNote: z.string().nullable().optional(),
  platformFeeOverride: z.number().min(0).max(100).nullable().optional(),
});
export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postAdminMandatesUpdateAdmin = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/mandates/update-admin`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
