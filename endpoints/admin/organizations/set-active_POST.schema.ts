import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  organizationId: z.number().int().positive(),
  isActive: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  organizationId: number;
  isActive: boolean;
};

export const postAdminSetOrganizationActive = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(body);
  const result = await fetch(`/_api/admin/organizations/set-active`, {
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