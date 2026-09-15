import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  userId: z.number().int().positive(),
  isActive: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  userId: number;
  isActive: boolean;
};

export const postAdminToggleUserStatus = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/user/toggle-status`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};