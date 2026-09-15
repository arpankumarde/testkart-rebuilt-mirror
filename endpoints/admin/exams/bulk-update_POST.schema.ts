import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  examIds: z.array(z.number()).min(1, "Select at least one exam."),
  categoryId: z.number().optional(),
  ownerTag: z.string().nullable().optional(),
  contentDueDate: z.date().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  updatedCount: number;
};

export const postAdminBulkUpdateExams = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exams/bulk-update`, {
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
