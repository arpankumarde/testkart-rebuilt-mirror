import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CareerPostings } from "../../helpers/schema";

export const schema = z.object({
  slug: z.string().min(1),
});

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | {
      career: Selectable<CareerPostings>;
    }
  | {
      error: string;
    };

export const getCareerDetails = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams({ slug: input.slug });
  const result = await fetch(`/_api/careers/details?${searchParams.toString()}`, {
    method: "GET",
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