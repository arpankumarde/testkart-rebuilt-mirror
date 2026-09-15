import { z } from "zod";
import superjson from "superjson";
import { User } from "../../../helpers/User";

export const schema = z
  .object({
    displayName: z.string().min(2, "Display name must be at least 2 characters.").optional(),
    avatarUrl: z.string().url("Invalid URL for avatar.").or(z.literal("")).optional().nullable(),
    avatarFileId: z.string().optional().nullable(),
    bio: z.string().max(500, "Bio must be 500 characters or less.").optional(),
  })
  .strict();

export type InputType = z.infer<typeof schema>;

export type OutputType = User;

export const postStudentProfileUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/profile/update`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};