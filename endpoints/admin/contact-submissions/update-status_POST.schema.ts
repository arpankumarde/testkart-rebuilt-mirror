import { z } from "zod";
import superjson from "superjson";
import { ContactSubmissionStatusArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive(),
  status: z.enum(ContactSubmissionStatusArrayValues),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postAdminUpdateContactSubmissionStatus = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/contact-submissions/update-status`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const responseJson = superjson.parse(await result.text());

  if (!result.ok) {
    const errorObject = responseJson as { error: string };
    throw new Error(
      errorObject.error || "Failed to update contact submission status"
    );
  }

  return responseJson as OutputType;
};