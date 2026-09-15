import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CareerPostings } from "../../helpers/schema";

export const schema = z.object({});

export type OutputType = {
  careers: Selectable<CareerPostings>[];
};

export const getCareersList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/careers/list`, {
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