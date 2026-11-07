import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  /** False when the super admin's own session had ended; they are signed out and sign in again. */
  restored: boolean;
};

export const postAdminProfileStopImpersonating = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/profile/stop-impersonating`, {
    method: "POST",
    body: superjson.stringify({}),
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
