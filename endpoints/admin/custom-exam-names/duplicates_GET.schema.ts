import { z } from "zod";
import superjson from "superjson";
import type { DuplicateGroup } from "../../../helpers/duplicateExamNames";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  groups: DuplicateGroup[];
};

export const getAdminCustomExamNameDuplicates = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/custom-exam-names/duplicates`, {
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
