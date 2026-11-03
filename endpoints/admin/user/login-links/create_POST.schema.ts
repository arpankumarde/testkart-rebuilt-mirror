import { z } from "zod";
import superjson from "superjson";
import { isLoginLinkExpiryOption, type LoginLinkView } from "../../../../helpers/loginLinks";

export const schema = z.object({
  userId: z.number().int().positive(),
  expiresInMinutes: z
    .number()
    .int()
    .refine(isLoginLinkExpiryOption, "Pick one of the listed expiry times."),
  singleUse: z.boolean(),
  note: z.string().trim().max(300, "Keep the note under 300 characters.").optional(),
});

export type InputType = z.infer<typeof schema>;

/** token is returned only here, once. Build the link with buildLoginLinkUrl. */
export type OutputType = { link: LoginLinkView; token: string };

export const postAdminLoginLinkCreate = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/user/login-links/create`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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