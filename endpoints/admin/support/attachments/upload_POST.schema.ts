import { z } from "zod";
import superjson from "superjson";
import {
  supportAttachmentUploadSchema,
  type SupportAttachment,
} from "../../../../helpers/supportAttachmentRules";

export const schema = supportAttachmentUploadSchema;

export type InputType = z.infer<typeof schema>;
export type OutputType = SupportAttachment;

export const postAdminSupportAttachmentUpload = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/support/attachments/upload`, {
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
    let message = "";
    try {
      message = superjson.parse<{ error?: string }>(text)?.error ?? "";
    } catch {
      message = "";
    }
    throw new Error(message || "The file could not be uploaded. Try again.");
  }
  return superjson.parse<OutputType>(text);
};