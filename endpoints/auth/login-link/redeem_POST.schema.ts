import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  token: z.string().min(1).max(200),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: true };

export const postLoginLinkRedeem = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/login-link/redeem`, {
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