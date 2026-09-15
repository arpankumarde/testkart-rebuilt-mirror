import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { Reviews } from "../../helpers/schema";

export const schema = z.object({
  mockTestId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

type Review = Pick<Selectable<Reviews>, 'id' | 'rating' | 'reviewText' | 'createdAt' | 'testItemId'> & {
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  testItemTitle: string | null;
};

export type OutputType = {
  reviews: Review[];
};

export const getReviewsList = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    mockTestId: validatedParams.mockTestId.toString(),
  });

  const result = await fetch(`/_api/reviews/list?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch reviews");
  }

  return superjson.parse<OutputType>(await result.text());
};