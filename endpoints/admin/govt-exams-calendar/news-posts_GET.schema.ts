import { z } from "zod";
import { gecGet } from "../../../helpers/gecFetch";

/** Published Exam News articles only, searched by title or slug. */
export const schema = z.object({
  q: z.string().trim().max(120).optional(),
  examId: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type GecNewsOption = {
  id: number;
  slug: string;
  title: string;
  newsType: string;
  publishedAt: string | null;
  examName: string | null;
  suggested: boolean;
};

export type OutputType = { posts: GecNewsOption[] };

export const getAdminGecNewsPosts = (input: InputType, init?: RequestInit) =>
  gecGet<OutputType>("admin/govt-exams-calendar/news-posts", { q: input.q, examId: input.examId }, init);