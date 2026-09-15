import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: true } | { error: string };

export const postAdminStopImpersonating = async (body?: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/stopImpersonating`, {
    method: "POST",
    body: superjson.stringify(body ?? {}),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = await result.json().catch(() => ({ error: "An unknown error occurred" }));
    throw new Error(errorObject.error);
  }
  return result.json();
};