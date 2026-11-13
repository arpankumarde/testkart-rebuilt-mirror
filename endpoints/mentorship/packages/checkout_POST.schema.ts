import { z } from "zod";
import superjson from "superjson";
import type { CashfreeMode } from "../../../helpers/cashfreeCheckout";

/** Starts a package: the student sets up autopay and pays first, then picks class times for the paid classes. */
export const schema = z.object({
  teacherId: z.number().int().positive(),
  classesPerWeek: z.number().int().min(1).max(6),
  classMinutes: z.union([z.literal(25), z.literal(50)]),
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
