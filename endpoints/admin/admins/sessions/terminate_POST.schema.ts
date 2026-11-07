import { z } from "zod";
import superjson from "superjson";

/** One sign-in of the admin by id, or all of them. */
export const schema = z.union([
  z.object({ adminId: z.number().int().positive(), sessionId: z.string().min(1).max(100) }).strict(),
  z.object({ adminId: z.number().int().positive(), all: z.literal(true) }).strict(),
]);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  terminated: number;
};

export const postAdminAdminsSessionsTerminate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/admins/sessions/terminate`, {
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
