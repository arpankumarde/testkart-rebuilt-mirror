import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type ExamSubjects } from "../../../helpers/schema";

export const schema = z.object({
  examId: z.number(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  subjects: Selectable<ExamSubjects>[];
};

export const getAdminExamSubjects = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  searchParams.set("examId", params.examId.toString());

  const result = await fetch(
    `/_api/admin/exam-subjects/list?${searchParams.toString()}`,
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