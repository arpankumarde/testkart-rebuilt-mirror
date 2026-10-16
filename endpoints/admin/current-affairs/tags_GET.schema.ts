import { z } from "zod";
import superjson from "superjson";
import type { CurrentAffairsTagKind } from "../../../helpers/schema";

export const schema = z.object({});

export type CurrentAffairsTagOption = {
  id: number;
  kind: CurrentAffairsTagKind;
  name: string;
  slug: string;
  isPredefined: boolean;
  examId: number | null;
  usageCount: number;
};

export type OutputType = { tags: CurrentAffairsTagOption[] };

export const getAdminCurrentAffairsTags = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/current-affairs/tags`, {
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