import { z } from "zod";
import superjson from "superjson";
import { INDIAN_MOBILE_PATTERN } from "../../../helpers/liveTeachingRules";

/* Only fills what the account is missing; changing an existing email or number stays in Settings. */
export const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional(),
  mobileNumber: z
    .string()
    .trim()
    .regex(INDIAN_MOBILE_PATTERN, "Enter a valid 10-digit Indian mobile number.")
    .optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { email: string | null; mobileNumber: string | null };

export const postTeacherLiveTeachingContact = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/live-teaching/contact`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};