import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type ExamCategories } from "../../../helpers/schema";

export const schema = z.object({
  categoryName: z.string().min(3, "Category name must be at least 3 characters"),
  categorySlug: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  category: Selectable<ExamCategories>;
};

export const postAdminCreateExamCategory = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exam-categories/create`, {
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