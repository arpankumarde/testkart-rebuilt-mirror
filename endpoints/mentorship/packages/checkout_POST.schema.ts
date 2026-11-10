import { z } from "zod";
import superjson from "superjson";
import type { CashfreeMode } from "../../../helpers/cashfreeCheckout";

/** Starts a package: the picked class times are held, then the student sets up autopay and pays. */
export const schema = z.object({
  teacherId: z.number().int().positive(),
  classesPerWeek: z.number().int().min(1).max(6),
  classMinutes: z.union([z.literal(25), z.literal(50)]),
  /** Exactly classesPerWeek x 4 start times inside the next 4 weeks, at most one a day. */
  startTimes: z.array(z.coerce.date()).min(4).max(24),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  packageId: string;
  subsSessionId: string;
  mode: CashfreeMode;
};

export const postMentorshipPackageCheckout = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/packages/checkout`, {
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
