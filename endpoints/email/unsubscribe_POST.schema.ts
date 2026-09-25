import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  list: z.string().min(1).max(64),
  token: z.string().min(1).max(200),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postEmailUnsubscribe = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/email/unsubscribe`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const responseJson = superjson.parse(await result.text());

  if (!result.ok) {
    const errorObject = responseJson as { error: string };
    throw new Error(errorObject.error || "Could not unsubscribe");
  }

  return responseJson as OutputType;
};