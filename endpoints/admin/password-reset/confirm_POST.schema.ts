import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  token: z
    .string({ required_error: "This reset link is incomplete" })
    .min(1, "This reset link is incomplete")
    .max(128, "This reset link is invalid"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password must be 64 characters or fewer"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
};

export const postAdminPasswordResetConfirm = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/password-reset/confirm`, {
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