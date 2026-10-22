import { z } from "zod";
import superjson from "superjson";
import type { ExamNewsType } from "../../helpers/schema";
import type { PublicExamNewsCard } from "./list_GET.schema";

export const schema = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(255),
});

export type InputType = z.infer<typeof schema>;

/** A published story without admin-only fields. Blank optional fields come back as null. */
export type PublicExamNewsStory = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  newsType: ExamNewsType;
  exam: { name: string; slug: string } | null;
  authorName: string | null;
  body: string;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  heroImageCredit: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  keyDates: {
    eventName: string;
    /** Free text as the admin wrote it, a date or a status such as "To be announced". */
    startDate: string | null;
    endDate: string | null;
    examDate: string | null;
    resultDate: string | null;
    note: string | null;
  }[];
  officialSource: { name: string; url: string } | null;
  sources: { name: string; url: string }[];
  corrections: { date: string; note: string }[];
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
};

export type OutputType = {
  story: PublicExamNewsStory;
  /** Where the story lives now; a request on an older slug redirects here. */
  canonicalPath: string;
  /** Newer stories for the same exam, or the latest stories when it has no exam or no others. */
  related: PublicExamNewsCard[];
  relatedIsSameExam: boolean;
};

export const getExamNewsDetails = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/exam-news/details?${new URLSearchParams({ slug: input.slug }).toString()}`, {
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