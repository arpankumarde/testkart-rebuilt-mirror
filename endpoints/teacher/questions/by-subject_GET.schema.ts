import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TestQuestions } from "../../../helpers/schema";

export const schema = z.object({
  subjectId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<TestQuestions>[];

export const getTeacherQuestionsBySubject = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const queryParams = new URLSearchParams({
    subjectId: validatedParams.subjectId.toString(),
  });

  const result = await fetch(
    `/_api/teacher/questions/by-subject?${queryParams}`,
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