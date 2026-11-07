import { z } from "zod";
import superjson from "superjson";

/** Either one sign-in by id, or every sign-in other than the one making the request. */
export const schema = z.union([
  z.object({ sessionId: z.string().min(1).max(100) }).strict(),
  z.object({ others: z.literal(true) }).strict(),
]);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  /** Sign-ins that were ended and had been seen; "others" also ends any that had not. */
  terminated: number;
  /** True when the ended sign-in was this browser's own, which is now signed out. */
  signedOutSelf: boolean;
};

export const postAdminProfileSessionsTerminate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/profile/sessions/terminate`, {
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
