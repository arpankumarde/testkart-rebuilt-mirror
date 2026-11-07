import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ adminId: z.number().int().positive() }).strict();

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  /** The admin the browser is now signed in as. */
  fullName: string;
};

export const postAdminAdminsImpersonate = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/admins/impersonate`, {
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
