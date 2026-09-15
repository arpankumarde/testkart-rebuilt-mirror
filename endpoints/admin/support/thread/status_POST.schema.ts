import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { SupportThreads, SupportThreadStatusArrayValues } from "../../../../helpers/schema";

export const schema = z.object({
  threadId: z.number().int().positive(),
  status: z.enum(SupportThreadStatusArrayValues),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = Selectable<SupportThreads>;

export const postAdminSupportThreadStatus = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/support/thread/status`, {
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