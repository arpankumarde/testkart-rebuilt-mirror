import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  // The free-text custom names to fold into targetExamId. Any mockTests /
  // digitalProducts rows currently carrying one of these names (with no
  // examId yet) get repointed to the target exam; the custom name then
  // simply stops showing up in the backlog since nothing references it
  // with a null examId anymore.
  sourceNames: z.array(z.string().min(1)).min(1, "Select at least one name to merge"),
  targetExamId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  mergedMockTests: number;
  mergedProducts: number;
  targetExam: { id: number; examName: string; examSlug: string };
};

export const postAdminMergeCustomExamNames = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/custom-exam-names/merge`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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
