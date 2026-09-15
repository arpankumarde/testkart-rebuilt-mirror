import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TeacherCourseListItem = Omit<Selectable<Courses>, "price"> & {
  price: number;
  sectionsCount: number;
  lessonsCount: number;
};

export type OutputType = TeacherCourseListItem[];

export const getTeacherCoursesList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/courses/list`, {
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