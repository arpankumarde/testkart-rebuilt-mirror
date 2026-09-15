import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseProgress } from "../../../helpers/schema";

export const schema = z.object({
  lessonId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  progress: Selectable<CourseProgress> | undefined;
  completionPercentage: number;
};

export const postStudentCourseMarkComplete = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/course/mark-complete`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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