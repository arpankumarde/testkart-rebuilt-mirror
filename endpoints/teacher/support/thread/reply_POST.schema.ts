import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { SupportMessages } from "../../../../helpers/schema";

export const schema = z.object({
  threadId: z.number().int().positive(),
  message: z.string().min(1, "Message is required"),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = Selectable<SupportMessages>;

export const postTeacherSupportThreadReply = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/support/thread/reply`, {
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