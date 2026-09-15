import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseLessons, LessonContentTypeArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  lessonId: z.number().int().positive(),
  title: z.string().min(1, "Title is required."),
  contentType: z.enum(LessonContentTypeArrayValues),
  contentUrl: z.string().url().optional().nullable(),
  textContent: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(0).optional().nullable(),
  isPreview: z.boolean().default(false),
  description: z.string().optional().nullable(),
  contentFileId: z.string().optional().nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<CourseLessons>;

export const postTeacherCourseLessonsUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/course-lessons/update`, {
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