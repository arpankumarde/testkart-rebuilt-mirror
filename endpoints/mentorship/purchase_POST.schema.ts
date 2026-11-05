import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  teacherId: z.number().int().positive(),
  /** 25 or 50 minutes - see MENTORSHIP_SESSION_DURATIONS. */
  durationMinutes: z.number().int().positive(),
  startTime: z.coerce.date(),
  deepLinkUrl: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  payuUrl: string;
  udf1?: string;
};

export const postMentorshipPurchase = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/mentorship/purchase`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(await result.text());
    throw new Error(errorObject.details || errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
