import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses, CourseLevelArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters long."),
  category: z.string().min(1, "Category is required."),
  level: z.enum(CourseLevelArrayValues),
  price: z.number().min(0, "Price cannot be negative."),
  thumbnailUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  thumbnailFileId: z.string().optional().nullable(),
  thumbnailImageUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  thumbnailImageFileId: z.string().optional().nullable(),
  introVideoUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  introVideoFileId: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  examName: z.string().optional().nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<Courses>, "price"> & {
  price: number;
};

export const postTeacherCoursesCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/courses/create`, {
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