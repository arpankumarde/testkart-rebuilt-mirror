import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { QuestionBank, QuestionTypeArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  search: z.string().optional(),
  sourceMockTestId: z.coerce.number().int().optional(),
  directlyUploaded: z.coerce.boolean().optional(),
  subjectName: z.string().optional(),
  questionType: z.enum(QuestionTypeArrayValues as [string, ...string[]]).optional(),
  tags: z.string().optional(), // Comma separated string for tag filtering
  sourceTestItemId: z.coerce.number().int().optional(),
  checkSubjectId: z.coerce.number().int().optional(),
});

export type InputType = z.infer<typeof schema>;

export type QuestionBankWithMeta = Selectable<QuestionBank> & {
  sourceTestSeriesTitle: string | null;
  sourceTestItemTitle: string | null;
  alreadyImportedToSubject: boolean;
};

export type OutputType = {
  questions: QuestionBankWithMeta[];
  availableSubjects: string[];
  total: number;
  page: number;
  limit: number;
};

export const getTeacherQuestionBankList = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const queryParams = new URLSearchParams();
  if (validatedParams.page) queryParams.set("page", validatedParams.page.toString());
  if (validatedParams.limit) queryParams.set("limit", validatedParams.limit.toString());
  if (validatedParams.search) queryParams.set("search", validatedParams.search);
  if (validatedParams.sourceMockTestId) queryParams.set("sourceMockTestId", validatedParams.sourceMockTestId.toString());
  if (validatedParams.directlyUploaded !== undefined) queryParams.set("directlyUploaded", String(validatedParams.directlyUploaded));
  if (validatedParams.subjectName) queryParams.set("subjectName", validatedParams.subjectName);
  if (validatedParams.questionType) queryParams.set("questionType", validatedParams.questionType);
  if (validatedParams.tags) queryParams.set("tags", validatedParams.tags);
  if (validatedParams.sourceTestItemId) queryParams.set("sourceTestItemId", validatedParams.sourceTestItemId.toString());
  if (validatedParams.checkSubjectId) queryParams.set("checkSubjectId", validatedParams.checkSubjectId.toString());

  const result = await fetch(`/_api/teacher/question-bank/list?${queryParams.toString()}`, {
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