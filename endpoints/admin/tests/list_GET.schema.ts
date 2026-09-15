import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTests, Users, Exams } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminTestListItem = Pick<
  Selectable<MockTests>,
  | "id"
  | "title"
  | "slug"
  | "isPublished"
  | "createdAt"
  | "deletedAt"
  | "studentsEnrolled"
  | "totalTests"
  | "totalQuestions"
  | "isFree"
  | "description"
  | "thumbnailUrl"
  | "language"
  | "reviewsCount"
  | "freeTestsCount"
> & {
  price: number;
  discountPrice: number | null;
  rating: number | null;
  teacherName: Selectable<Users>["displayName"];
  teacherId: Selectable<Users>["id"];
  examSlug: Selectable<Exams>["examSlug"] | null;
  examName: Selectable<Exams>["examName"] | null;
  aiQuestionsCount: number;
  manualQuestionsCount: number;
  totalOrders: number;
  /* Non-deleted tests in the series, counted live. totalTests is a stored counter. */
  liveItemCount: number;
  /* Non-deleted tests in the series that have no questions. */
  emptyTestCount: number;
};

export type OutputType = AdminTestListItem[];

export const getAdminTestsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/tests/list`, {
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