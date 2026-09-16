import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { SupportMessages } from "../../../../helpers/schema";
import type { SupportAttachment } from "../../../../helpers/supportAttachmentRules";

export const schema = z.object({
  threadId: z.coerce.number().int().positive()
});

export type InputType = z.infer<typeof schema>;
export type OutputType = (Selectable<SupportMessages> & { senderName: string; attachments: SupportAttachment[] })[];

export const getAdminSupportThreadMessages = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const url = new URL("/_api/admin/support/thread/messages", window.location.origin);
  if (query.threadId) url.searchParams.set("threadId", query.threadId.toString());

  const result = await fetch(url.toString(), {
    method: "GET",
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