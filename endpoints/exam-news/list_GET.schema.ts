import { z } from "zod";
import superjson from "superjson";
import type { ExamNewsType } from "../../helpers/schema";
import { NEWS_TYPE_VALUES } from "../admin/exam-news/save_POST.schema";

export const schema = z.object({
  type: z.enum(NEWS_TYPE_VALUES).optional(),
  /** An exam slug, e.g. "neet-ug". */
  exam: z.string().trim().toLowerCase().max(120).optional(),
  /** Matched against headlines. */
  q: z.string().trim().max(120).optional(),
  page: z.number().int().min(1).max(1000).default(1),
});

export type InputType = z.input<typeof schema>;

export type PublicExamNewsCard = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  newsType: ExamNewsType;
  examName: string | null;
  examSlug: string | null;
  thumbnailUrl: string | null;
  thumbnailAlt: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type OutputType = {
  rows: PublicExamNewsCard[];
  total: number;
  totalPages: number;
  page: number;
  /** The exam asked for, when it exists; null for an unknown slug. */
  exam: { id: number; name: string; slug: string } | null;
};

export const getExamNewsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const result = await fetch(`/_api/exam-news/list?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};