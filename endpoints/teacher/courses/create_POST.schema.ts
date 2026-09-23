import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses, CourseLevelArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  // Optional while drafting; teacher/courses/publish requires one.
  description: z.string().optional(),
  category: z.string().min(1, "Category is required."),
  level: z.enum(CourseLevelArrayValues),
  price: z.number().min(0, "Price cannot be negative."),
  discountPrice: z.number().min(0, "Discounted price cannot be negative.").optional().nullable(),
  thumbnailUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  thumbnailFileId: z.string().optional().nullable(),
  thumbnailImageUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  thumbnailImageFileId: z.string().optional().nullable(),
  introVideoUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  introVideoFileId: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  examName: z.string().optional().nullable(),
  examNames: z
    .array(z.string().trim().min(1))
    .max(5)
    .optional()
    .describe("Official exam names, up to 5, first is the primary"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<Courses>, "price" | "discountPrice"> & {
  price: number;
  discountPrice: number | null;
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