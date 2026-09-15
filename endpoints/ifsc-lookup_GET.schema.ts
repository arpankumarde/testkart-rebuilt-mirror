import { z } from "zod";
import superjson from "superjson";

/* Four letters, a zero, then six alphanumerics - e.g. SBIN0001234. Kept here
   so the two bank-details forms and both add_POST schemas test the same shape. */
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const isValidIfscFormat = (value: string): boolean =>
  IFSC_PATTERN.test(value.trim().toUpperCase());

export const schema = z.object({
  ifsc: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => IFSC_PATTERN.test(v), {
      message: "Invalid IFSC format. It should be like SBIN0001234.",
    }),
});

export type InputType = z.input<typeof schema>;

export type OutputType = {
  ifsc: string;
  bank: string;
  branch: string | null;
  city: string | null;
  state: string | null;
};

/*
 * Thrown for both failure modes so a caller can tell them apart: notFound
 * means the directory answered and has no such branch, which is the user's
 * typo to fix; otherwise the directory could not be reached, which is not.
 * The forms word their warning differently for each.
 */
export class IfscLookupError extends Error {
  readonly notFound: boolean;

  constructor(message: string, notFound: boolean) {
    super(message);
    this.name = "IfscLookupError";
    this.notFound = notFound;
  }
}

export const getIfscLookup = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const queryParams = new URLSearchParams({ ifsc: validatedParams.ifsc });
  const result = await fetch(`/_api/ifsc-lookup?${queryParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; notFound?: boolean }>(
      await result.text()
    );
    throw new IfscLookupError(errorObject.error, errorObject.notFound === true);
  }

  return superjson.parse<OutputType>(await result.text());
};
