import { z } from "zod";
import superjson from "superjson";
import type { CurrentAffairsStatus } from "../../../helpers/schema";
import type { ValidationIssue } from "./save_POST.schema";
import { CurrentAffairsValidationError } from "./save_POST.schema";

export const schema = z.object({
  id: z.number().int().positive(),
  action: z.enum(["publish", "unpublish", "archive", "restore"]),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: true; status: CurrentAffairsStatus };

export const postAdminCurrentAffairsStatus = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/current-affairs/status`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; issues?: ValidationIssue[] }>(await result.text());
    if (errorObject.issues?.length) throw new CurrentAffairsValidationError(errorObject.error, errorObject.issues);
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};