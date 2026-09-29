import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTests } from "../../../helpers/schema";
import type { ContentExam } from "../../../helpers/contentExams";
import type { ContentRejection } from "../../../helpers/contentReviewStatus";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TeacherTest = Omit<Selectable<MockTests>, "price" | "rating"> & {
  price: number;
  rating: number | null;
  testItemsCount: number;
  examSlug: string | null;
  /** Every exam the series is listed under, primary first. */
  exams: ContentExam[];
  /** Submitted for publishing and waiting on admin approval. */
  inReview: boolean;
  /** Set when the latest review was rejected, with the admin's reason. */
  rejection: ContentRejection | null;
};

export type OutputType = TeacherTest[];

export const getTeacherTestsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/tests/list`, {
    method: "GET",
    cache: "no-store",
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