import { z } from "zod";
import superjson from "superjson";
import {
  CUSTOM_PAGE_LABEL_MAX,
  CUSTOM_PAGE_SLUG_PATTERN,
  customPageSlugProblem,
  type ExamCustomPage,
} from "../../../../helpers/examContentTypes";

export const schema = z.object({
  examId: z.number().int().positive(),
  slug: z.string().regex(CUSTOM_PAGE_SLUG_PATTERN),
  label: z
    .string()
    .trim()
    .min(1, "Give the page a name.")
    .max(CUSTOM_PAGE_LABEL_MAX, `Keep the name under ${CUSTOM_PAGE_LABEL_MAX} characters.`),
  // Only sent when the admin edits the URL; the slug stays as it is otherwise.
  newSlug: z
    .string()
    .trim()
    .superRefine((slug, ctx) => {
      const problem = customPageSlugProblem(slug);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    })
    .optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  customPage: ExamCustomPage;
};

export const postAdminUpdateExamCustomPage = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exam-content/custom-page/update`, {
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