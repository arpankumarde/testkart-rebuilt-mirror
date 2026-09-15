import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type TestQuestions, type Users, type Exams, type MockTests, type MockTestItems, type TestItemSubjects } from "../../../helpers/schema";

export const schema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  examId: z.number().optional(),
  teacherId: z.number().optional(),
  hasCustomPrompt: z.boolean().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  markedForReview: z.boolean().optional(),
  searchQuery: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type AIQuestionListItem = Selectable<TestQuestions> & {
  subjectName: Selectable<TestItemSubjects>["subjectName"] | null;
  subjectId: Selectable<TestItemSubjects>["id"] | null;
  testItemTitle: Selectable<MockTestItems>["title"];
  testItemId: Selectable<MockTestItems>["id"];
  testPackageName: Selectable<MockTests>["title"];
  examName: Selectable<Exams>["examName"];
  teacherId: Selectable<Users>["id"];
  teacherName: Selectable<Users>["displayName"];
  academyName: Selectable<Users>["academyName"];
};

export type OutputType = {
  questions: AIQuestionListItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export const getAdminAIQuestionsList = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (value instanceof Date) {
        searchParams.set(key, value.toISOString());
      } else {
        searchParams.set(key, String(value));
      }
    }
  });

  const result = await fetch(
    `/_api/admin/ai-questions/list?${searchParams.toString()}`,
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