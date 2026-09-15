import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { EmailTemplates } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

// We define a specific output type to ensure placeholders is typed correctly as string[]
export type EmailTemplate = Omit<Selectable<EmailTemplates>, "placeholders"> & {
  placeholders: string[];
};

export type OutputType = {
  templates: EmailTemplate[];
};

export const getAdminEmailTemplatesList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/email-templates/list`, {
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