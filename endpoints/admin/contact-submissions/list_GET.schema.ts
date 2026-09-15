import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import {
  ContactSubmissions,
  ContactSubmissionStatusArrayValues,
} from "../../../helpers/schema";

export const schema = z.object({
  status: z.enum(ContactSubmissionStatusArrayValues).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  submissions: Selectable<ContactSubmissions>[];
  total: number;
};

export const getAdminContactSubmissions = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const queryParams = new URLSearchParams();
  if (validatedParams.status) {
    queryParams.append("status", validatedParams.status);
  }
  queryParams.append("limit", validatedParams.limit.toString());
  queryParams.append("offset", validatedParams.offset.toString());

  const result = await fetch(
    `/_api/admin/contact-submissions/list?${queryParams.toString()}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};