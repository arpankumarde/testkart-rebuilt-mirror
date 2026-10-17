import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().trim().min(4).max(10),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  organizationSlug: string;
};

export const postTeacherOrganizationsClaimVerify = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/organizations/claim/verify`, {
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
