import { z } from "zod";
import superjson from "superjson";
import {
  CUSTOM_PAGE_LABEL_MAX,
  customPageSlugProblem,
  type ExamCustomPage,
} from "../../../../helpers/examContentTypes";

export const schema = z.object({
  examId: z.number().int().positive(),
  label: z
    .string()
    .trim()
    .min(1, "Give the page a name.")
    .max(CUSTOM_PAGE_LABEL_MAX, `Keep the name under ${CUSTOM_PAGE_LABEL_MAX} characters.`),
  slug: z.string().trim().superRefine((slug, ctx) => {
    const problem = customPageSlugProblem(slug);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  }),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  customPage: ExamCustomPage;
};

export const postAdminCreateExamCustomPage = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exam-content/custom-page/create`, {
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