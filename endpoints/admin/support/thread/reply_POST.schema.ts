import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { SupportMessages } from "../../../../helpers/schema";
import {
  hasSupportMessageContent,
  SUPPORT_EMPTY_MESSAGE,
  supportAttachmentsInputSchema,
  type SupportAttachment,
} from "../../../../helpers/supportAttachmentRules";

export const schema = z
  .object({
    threadId: z.number().int().positive(),
    message: z.string(),
    attachments: supportAttachmentsInputSchema,
  })
  .refine((input) => hasSupportMessageContent(input.message, input.attachments), {
    message: SUPPORT_EMPTY_MESSAGE,
    path: ["message"],
  });

export type InputType = z.infer<typeof schema>;
export type OutputType = Selectable<SupportMessages> & { attachments: SupportAttachment[] };

export const postAdminSupportThreadReply = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/support/thread/reply`, {
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