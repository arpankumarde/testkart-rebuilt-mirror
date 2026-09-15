import { z } from "zod";
import superjson from 'superjson';
import { Selectable } from "kysely";
import { Reviews } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type LatestReview = Pick<Selectable<Reviews>, 'id' | 'rating' | 'reviewText' | 'reviewerName' | 'createdAt' | 'mockTestId'> & {
  mockTestTitle: string;
};

export type OutputType = {
  reviews: LatestReview[];
};

export const getTeacherLatestReviews = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/reviews/latest`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch latest reviews");
  }

  return superjson.parse<OutputType>(await result.text());
};