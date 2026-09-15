import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  mockTestId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  orderId: number;
  message: string;
};

export const postTestsEnrollFree = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/tests/enroll-free`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};