import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses } from "../../../helpers/schema";

export const schema = z.object({
  courseId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<Courses>, "price"> & {
  price: number;
};

export const postTeacherCoursesUnpublish = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/courses/unpublish`, {
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