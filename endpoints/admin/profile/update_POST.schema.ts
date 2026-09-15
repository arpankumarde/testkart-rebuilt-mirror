import { z } from "zod";
import superjson from "superjson";
import { AdminProfile } from "../../../helpers/AdminTypes";

export const schema = z
  .object({
    fullName: z.string().min(1, "Full name cannot be empty.").max(200).optional(),
    avatarUrl: z.string().url("Invalid URL for avatar.").optional().nullable(),
    avatarFileId: z.string().optional().nullable(),
    bio: z.string().max(1000, "Bio must be 1000 characters or less.").optional().nullable(),
  })
  .strict();

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  admin: AdminProfile;
};

export const postAdminProfileUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/profile/update`, {
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
