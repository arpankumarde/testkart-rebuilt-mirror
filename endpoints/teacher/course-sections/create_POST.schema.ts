import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseSections } from "../../../helpers/schema";

export const schema = z.object({
  courseId: z.number().int().positive(),
  title: z.string().min(1, "Title is required."),
  description: z.string().optional().nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<CourseSections>;

export const postTeacherCourseSectionsCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/course-sections/create`, {
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