import { z } from "zod";
import superjson from "superjson";
import { ADMIN_EXAM_SECTION_TYPES } from "../../../helpers/examContentTypes";
import type { ExamContentPageItem } from "./list_GET.schema";

export const schema = z.object({
  examId: z.number().int().positive(),
  pageType: z.enum(ADMIN_EXAM_SECTION_TYPES),
  // "content" (default) drafts the main body for the 4 silo page types.
  // "faqs" drafts just the FAQ list — the only thing "overview" (the exam
  // hub page's FAQ block) ever generates, and an optional add-on for every
  // other section too.
  target: z.enum(["content", "faqs"]).optional().default("content"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  page: ExamContentPageItem;
};

export class AiExamContentError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
    this.name = "AiExamContentError";
  }
}

export const postAdminGenerateExamContent = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exam-content/generate`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; code?: string }>(await result.text());
    throw new AiExamContentError(errorObject.error, errorObject.code);
  }
  return superjson.parse<OutputType>(await result.text());
};
