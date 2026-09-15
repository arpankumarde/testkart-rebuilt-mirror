import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { ExamSubjects } from "../../../helpers/schema";

export const schema = z.object({
  examId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Pick<
  Selectable<ExamSubjects>,
  "id" | "subjectName" | "examId"
>[];

export const getTeacherExamSubjectsByExam = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const queryParams = new URLSearchParams({
    examId: validatedParams.examId.toString(),
  });

  const result = await fetch(
    `/_api/teacher/exam-subjects/by-exam?${queryParams}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};