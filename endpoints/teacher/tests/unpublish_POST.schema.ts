import { z } from "zod";
import superjson from "superjson";
import type { AffectedBundle } from "../../../helpers/bundleDependencies";

export const schema = z.object({
  testId: z.number().int().positive(),
  // Sent once the teacher has accepted that the published bundles holding the
  // test series go down with it. Without it, such a series is not unpublished.
  confirmBundleUnpublish: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  unpublishedBundles: AffectedBundle[];
};

export const postTeacherTestsUnpublish = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/tests/unpublish`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};