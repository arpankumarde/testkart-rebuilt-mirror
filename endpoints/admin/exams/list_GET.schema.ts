import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type Exams, type ExamCategories } from "../../../helpers/schema";

export const schema = z.object({
  categoryId: z.number().optional(),
});

export type InputType = z.infer<typeof schema>;

export type ExamWithCategory = Selectable<Exams> & {
  categoryName: Selectable<ExamCategories>["categoryName"];
};

export type OutputType = {
  exams: ExamWithCategory[];
};

export const getAdminExams = async (
  params?: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  if (params?.categoryId) {
    searchParams.set("categoryId", params.categoryId.toString());
  }

  const result = await fetch(
    `/_api/admin/exams/list?${searchParams.toString()}`,
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