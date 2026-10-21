import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().optional(),
});
export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  alreadyRegistered: boolean;
  joinUrl: string | null;
};

export const postMasterclassRegister = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/masterclasses/register`, {
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
