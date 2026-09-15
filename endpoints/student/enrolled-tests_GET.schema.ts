import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTests, MockTestItems, Orders } from "../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TestItemWithProgress = Pick<
  Selectable<MockTestItems>,
  | "id"
  | "title"
  | "description"
  | "subject"
  | "durationMinutes"
  | "totalQuestions"
  | "isFree"
  | "orderIndex"
  | "scheduledDate"
> & {
  attemptsCount: number;
  completedAttemptsCount: number;
  bestScore: number | null;
  lastAttemptedAt: Date | null;
  isCompleted: boolean;
};

export type EnrolledTest = Pick<
  Selectable<MockTests>,
  | "id"
  | "title"
  | "description"
  | "subject"
  | "price"
  | "thumbnailUrl"
  | "examName"
  | "teacherId"
  | "creatorName"
  | "totalTests"
  | "freeTestsCount"
  | "studentsEnrolled"
  | "rating"
  | "reviewsCount"
  | "durationMinutes"
  | "totalQuestions"
  | "slug"
  | "isPublished"
> & {
  enrolledAt: Selectable<Orders>["createdAt"];
  testItems: TestItemWithProgress[];
  totalItems: number;
  completedItems: number;
  progressPercentage: number;
  averageScore: number | null;
  hasReviewed: boolean;
  examSlug: string | null;
};

export type OutputType = {
  enrolledTests: EnrolledTest[];
};

export const getStudentEnrolledTests = async (
  body: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/student/enrolled-tests`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};