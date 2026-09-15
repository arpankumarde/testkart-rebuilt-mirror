import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  liveTestId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  isEnrolled: boolean;
  canEnroll: boolean;
  reason: string | null;
};

export const getLiveTestsCheckEnrollment = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    liveTestId: validatedParams.liveTestId.toString(),
  });

  const result = await fetch(
    `/_api/live-tests/check-enrollment?${searchParams.toString()}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};