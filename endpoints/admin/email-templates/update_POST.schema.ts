import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { EmailTemplates } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number().int(),
  subject: z.string().min(1, "Subject is required"),
  htmlContent: z.string().min(1, "HTML content is required"),
  textContent: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  template: Selectable<EmailTemplates>;
};

export const postAdminUpdateEmailTemplate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/email-templates/update`, {
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