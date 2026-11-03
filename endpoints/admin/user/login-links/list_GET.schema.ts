import { z } from "zod";
import superjson from "superjson";
import type { LoginLinkView } from "../../../../helpers/loginLinks";

export const schema = z.object({
  userId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { links: LoginLinkView[] };

export const getAdminLoginLinks = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(params);
  const result = await fetch(`/_api/admin/user/login-links/list?userId=${validated.userId}`, {
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