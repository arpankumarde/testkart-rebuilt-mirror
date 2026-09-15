import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  courseId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  enrollmentId: number;
  completionPercentage: number;
  completedLessonIds: number[];
};

export const getStudentCourseProgress = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    courseId: validatedParams.courseId.toString(),
  });

  const result = await fetch(
    `/_api/student/course/progress?${searchParams.toString()}`,
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