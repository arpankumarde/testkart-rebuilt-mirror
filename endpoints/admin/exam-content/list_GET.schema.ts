import { z } from "zod";
import superjson from "superjson";
import type { AdminExamSectionType, FaqItem } from "../../../helpers/examContentTypes";

export const schema = z.object({
  examId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type ExamContentPageItem = {
  id: number | null;
  examId: number;
  pageType: AdminExamSectionType;
  status: "draft" | "published";

  // Working draft — what the admin is editing. May differ from what's live.
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  // Short subtitle line shown under the page's H1 — currently only rendered
  // by the 4 product listing page types (see hasDescription in examContentTypes).
  description: string | null;
  content: string | null;
  faqItems: FaqItem[] | null;
  source: "manual" | "ai";
  aiGeneratedAt: Date | null;

  // Live snapshot — what's actually served on the public site right now.
  publishedTitle: string | null;
  publishedSeoTitle: string | null;
  publishedSeoDescription: string | null;
  publishedDescription: string | null;
  publishedContent: string | null;
  publishedFaqItems: FaqItem[] | null;
  publishedAt: Date | null;

  reviewedByAdminId: number | null;
  reviewedByAdminName: string | null;
  reviewedAt: Date | null;
  // Set when an admin marks the saved draft ready for review. Kept apart from
  // status, so a published section can have edits waiting for review while its
  // live copy stays up. Publishing clears it.
  readyForReviewAt: Date | null;
  readyForReviewByAdminId: number | null;
  readyForReviewByAdminName: string | null;
  updatedAt: Date | null;
};

export type OutputType = {
  exam: {
    id: number;
    examName: string;
    fullName: string;
    examSlug: string;
    categoryName: string;
  };
  pages: ExamContentPageItem[];
};

export const getAdminExamContentList = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(input);
  const searchParams = new URLSearchParams({
    examId: String(validatedInput.examId),
  });
  const result = await fetch(`/_api/admin/exam-content/list?${searchParams.toString()}`, {
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
