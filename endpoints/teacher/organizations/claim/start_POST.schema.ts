import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  organizationId: z.string().uuid(),
  method: z.enum(["phone", "email"]),
  // The exact masked-option value from claim/options - never a value the
  // teacher typed themselves. The server re-checks it against the
  // organisation's own stored contact before sending anything.
  contactValue: z.string().min(3).max(300),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  maskedDestination: string;
  expiresInMinutes: number;
};

export const postTeacherOrganizationsClaimStart = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/organizations/claim/start`, {
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
