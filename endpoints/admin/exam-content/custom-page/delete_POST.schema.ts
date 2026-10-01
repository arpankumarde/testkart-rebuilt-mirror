import { z } from "zod";
import superjson from "superjson";
import { CUSTOM_PAGE_SLUG_PATTERN } from "../../../../helpers/examContentTypes";

export const schema = z.object({
  examId: z.number().int().positive(),
  slug: z.string().regex(CUSTOM_PAGE_SLUG_PATTERN),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  wasPublished: boolean;
};

export const postAdminDeleteExamCustomPage = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exam-content/custom-page/delete`, {
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