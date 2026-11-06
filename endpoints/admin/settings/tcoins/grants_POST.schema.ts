import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  /** The student's email address or 10-digit mobile number. */
  student: z.string().trim().min(3).max(200),
  coins: z.number().int().min(1).max(10000),
  /** Last day the coins can be used, YYYY-MM-DD in India time; they expire at the end of it. */
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(200).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  grant: { id: number; coins: number; expiresAt: Date; studentName: string | null; studentEmail: string | null };
};

export const postAdminTcoinGrant = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/settings/tcoins/grants`, {
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