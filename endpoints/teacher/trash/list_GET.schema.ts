import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTests, MockTestItems } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TrashedTest = Pick<
  Selectable<MockTests>,
  | "id"
  | "title"
  | "slug"
  | "examName"
  | "totalTests"
  | "totalQuestions"
  | "studentsEnrolled"
  | "isPublished"
  | "wasEverPublished"
  | "deletedAt"
  | "createdAt"
> & {
  price: number;
  testItemsCount: number;
  daysRemaining: number;
};

export type TrashedTestItem = Pick<
  Selectable<MockTestItems>,
  "id" | "title" | "subject" | "durationMinutes" | "totalQuestions" | "deletedAt"
> & {
  daysRemaining: number;
  parentTestId: number;
  parentTestTitle: string;
  questionsCount: number;
};

export type OutputType = {
  trashedTests: TrashedTest[];
  trashedTestItems: TrashedTestItem[];
};

export const getTeacherTrashList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/trash/list`, {
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