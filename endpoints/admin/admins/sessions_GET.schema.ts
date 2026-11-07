import { z } from "zod";
import superjson from "superjson";
import type { AdminSessionSummary } from "../../../helpers/adminSessions";

export const schema = z.object({
  adminId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  sessions: AdminSessionSummary[];
};

export const getAdminAdminsSessions = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(params);
  const result = await fetch(`/_api/admin/admins/sessions?adminId=${validated.adminId}`, {
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
