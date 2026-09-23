import { z } from "zod";
import superjson from "superjson";
import { ADMIN_EDIT_TYPES } from "../../../helpers/adminContentEdit";

export const schema = z.object({
  type: z.enum(ADMIN_EDIT_TYPES),
  id: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  /** Session for the item's teacher, limited to editing this content type. */
  token: string;
  expiresAt: Date;
  teacher: { id: number; name: string };
  title: string;
};

export const postAdminContentEditSession = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(body);
  const result = await fetch(`/_api/admin/content-edit/session`, {
    method: "POST",
    body: superjson.stringify(validated),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};