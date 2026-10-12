import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  membershipId: z.number().int().positive(),
  approve: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
};

export const postTeacherOrganizationsRespondRequest = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/organizations/respond-request`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};
