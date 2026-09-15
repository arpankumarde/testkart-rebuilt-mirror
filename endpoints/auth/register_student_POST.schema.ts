import { z } from "zod";
import { User } from "../../helpers/User";
import superjson from "superjson";

export const schema = z.object({
  email: z.string().email("Email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1, "Name is required"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  user: User;
};

export const postRegisterStudent = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/register_student`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await result.text();
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(text);
    throw new Error(errorObject.error || "Student registration failed");
  }

  return superjson.parse<OutputType>(text);
};