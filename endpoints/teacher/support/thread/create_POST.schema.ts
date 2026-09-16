import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { SupportThreads } from "../../../../helpers/schema";
import { supportAttachmentsInputSchema } from "../../../../helpers/supportAttachmentRules";

export const schema = z.object({
  subject: z.string().min(1, "Subject is required").max(255),
  message: z.string().min(1, "Message is required"),
  attachments: supportAttachmentsInputSchema,
});

export type InputType = z.infer<typeof schema>;
export type OutputType = Selectable<SupportThreads>;

export const postTeacherSupportThreadCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/support/thread/create`, {
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