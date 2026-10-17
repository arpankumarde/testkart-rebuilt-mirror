import { z } from "zod";
import superjson from "superjson";
import type { ExamNewsStatus } from "../../../helpers/schema";
import type { InputType as SaveInput } from "./save_POST.schema";

export const schema = z.object({
  id: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

/** The editable story in the editor's own shape, plus the read-only record fields. */
export type ExamNewsDetail = Omit<SaveInput, "status"> & {
  id: number;
  status: ExamNewsStatus;
  examName: string | null;
  examSlug: string | null;
  previousSlugs: string[];
  publishedAt: Date | null;
  firstPublishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
  createdByName: string | null;
  updatedByName: string | null;
};

export type OutputType = { post: ExamNewsDetail };

export const getAdminExamNewsPost = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ id: String(input.id) });
  const result = await fetch(`/_api/admin/exam-news/get?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};