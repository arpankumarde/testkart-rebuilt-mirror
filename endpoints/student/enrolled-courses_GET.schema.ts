import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses, CourseEnrollments, Users } from "../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type EnrolledCourse = Pick<
  Selectable<Courses>,
  "id" | "title" | "thumbnailUrl" | "thumbnailImageUrl" | "introVideoUrl" | "category"
> &
  Pick<
    Selectable<CourseEnrollments>,
    "enrolledAt" | "completionPercentage" | "lastAccessedAt"
   > & {
     teacherName: Selectable<Users>["displayName"];
     totalLessons: number;
    hasReviewed: boolean;
    reviewRating: number | null;
    reviewText: string | null;
  };

export type OutputType = {
  enrolledCourses: EnrolledCourse[];
};

export const getStudentEnrolledCourses = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/student/enrolled-courses`, {
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