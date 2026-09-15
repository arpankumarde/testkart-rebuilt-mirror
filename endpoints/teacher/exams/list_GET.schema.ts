import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type Exams, type ExamCategories } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type ExamForList = Pick<
  Selectable<Exams>,
  "id" | "examName" | "fullName"
> & {
  categoryName: Selectable<ExamCategories>["categoryName"];
};

export type OutputType = {
  exams: ExamForList[];
};

export const getExamsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/exams/list`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};