import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses, CourseSections, CourseLessons } from "../../../helpers/schema";

export const schema = z.object({
  courseId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

type SectionWithLessons = Selectable<CourseSections> & {
  lessons: Selectable<CourseLessons>[];
};

export type OutputType = Omit<Selectable<Courses>, "price"> & {
  price: number;
  sections: SectionWithLessons[];
  sectionsCount: number;
  lessonsCount: number;
  /** Submitted for publishing and waiting on admin approval. */
  inReview: boolean;
};

export const getTeacherCoursesDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    courseId: validatedParams.courseId.toString(),
  });

  const result = await fetch(
    `/_api/teacher/courses/details?${searchParams.toString()}`,
    {
      method: "GET",
      cache: "no-store",
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