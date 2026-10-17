import { z } from "zod";
import superjson from "superjson";
import type { ExamNewsStatus, ExamNewsType } from "../../../helpers/schema";
import { NEWS_TYPE_VALUES } from "./save_POST.schema";

export const schema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(["draft", "scheduled", "published", "archived"]).optional(),
  newsType: z.enum(NEWS_TYPE_VALUES).optional(),
  examId: z.number().int().positive().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type InputType = z.input<typeof schema>;

export type ExamNewsListRow = {
  id: number;
  title: string;
  slug: string;
  newsType: ExamNewsType;
  status: ExamNewsStatus;
  heroImageUrl: string | null;
  examId: number | null;
  examName: string | null;
  authorName: string | null;
  publishAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  keyDateCount: number;
  correctionCount: number;
};

export type OutputType = {
  rows: ExamNewsListRow[];
  total: number;
  totalPages: number;
  /** Per status, under every filter except status itself, for the tab counts. */
  statusCounts: Record<ExamNewsStatus, number>;
};

export const getAdminExamNewsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") params.append(key, String(value));
  }
  const result = await fetch(`/_api/admin/exam-news/list?${params.toString()}`, {
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