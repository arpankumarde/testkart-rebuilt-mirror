import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses, Users, CourseStatusArrayValues } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminCourseListItem = Pick<
  Selectable<Courses>,
  "id" | "title" | "slug" | "status" | "createdAt"
> & {
  price: number;
  teacherName: Selectable<Users>["displayName"];
  teacherId: Selectable<Users>["id"];
  studentsEnrolled: number;
  lessonsCount: number;
  videoLessonsCount: number;
  pdfLessonsCount: number;
  quizLessonsCount: number;
  textLessonsCount: number;
};

export type OutputType = AdminCourseListItem[];

export const getAdminCoursesList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/courses/list`, {
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