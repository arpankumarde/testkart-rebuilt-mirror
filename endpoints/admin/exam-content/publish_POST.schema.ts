import { z } from "zod";
import superjson from "superjson";
import { ADMIN_EXAM_SECTION_TYPES } from "../../../helpers/examContentTypes";
import type { ExamContentPageItem } from "./list_GET.schema";

export const schema = z.object({
  examId: z.number().int().positive(),
  pageType: z.enum(ADMIN_EXAM_SECTION_TYPES),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  page: ExamContentPageItem;
};

export const postAdminPublishExamContent = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exam-content/publish`, {
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
