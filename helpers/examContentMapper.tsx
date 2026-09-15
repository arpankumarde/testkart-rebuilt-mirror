import type { FaqItem } from "./examContentTypes";
import type { ExamContentPageItem } from "../endpoints/admin/exam-content/list_GET.schema";

// Shape returned by a `selectFrom("examContentPages")` query joined to admins
// twice: "admins" for the reviewer and "admins as readyForReviewAdmins" for
// whoever marked the draft ready for review. Shared by every admin
// exam-content endpoint so the row -> API-shape mapping (status/source casts,
// faqItems JSON casts) lives in exactly one place instead of being
// copy-pasted per endpoint.
export type ExamContentRowWithReviewer = {
  id: number;
  examId: number;
  pageType: string;
  status: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  description: string | null;
  content: string | null;
  faqItems: unknown;
  source: string;
  aiGeneratedAt: Date | null;
  publishedTitle: string | null;
  publishedSeoTitle: string | null;
  publishedSeoDescription: string | null;
  publishedDescription: string | null;
  publishedContent: string | null;
  publishedFaqItems: unknown;
  publishedAt: Date | null;
  reviewedByAdminId: number | null;
  reviewedByAdminName?: string | null;
  reviewedAt: Date | null;
  readyForReviewAt: Date | null;
  readyForReviewByAdminId: number | null;
  readyForReviewByAdminName?: string | null;
  updatedAt: Date | null;
};

export function mapExamContentRow(row: ExamContentRowWithReviewer): ExamContentPageItem {
  return {
    id: row.id,
    examId: row.examId,
    pageType: row.pageType as ExamContentPageItem["pageType"],
    status: row.status as ExamContentPageItem["status"],
    title: row.title,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    description: row.description,
    content: row.content,
    faqItems: (row.faqItems as FaqItem[] | null) ?? null,
    source: row.source as ExamContentPageItem["source"],
    aiGeneratedAt: row.aiGeneratedAt,
    publishedTitle: row.publishedTitle,
    publishedSeoTitle: row.publishedSeoTitle,
    publishedSeoDescription: row.publishedSeoDescription,
    publishedDescription: row.publishedDescription,
    publishedContent: row.publishedContent,
    publishedFaqItems: (row.publishedFaqItems as FaqItem[] | null) ?? null,
    publishedAt: row.publishedAt,
    reviewedByAdminId: row.reviewedByAdminId,
    reviewedByAdminName: row.reviewedByAdminName ?? null,
    reviewedAt: row.reviewedAt,
    readyForReviewAt: row.readyForReviewAt,
    readyForReviewByAdminId: row.readyForReviewByAdminId,
    readyForReviewByAdminName: row.readyForReviewByAdminName ?? null,
    updatedAt: row.updatedAt,
  };
}

// The full column list to select from examContentPages and both admins joins,
// in the shape mapExamContentRow expects - shared so every endpoint queries
// the same columns instead of drifting.
export const EXAM_CONTENT_SELECT_COLUMNS = [
  "examContentPages.id",
  "examContentPages.examId",
  "examContentPages.pageType",
  "examContentPages.status",
  "examContentPages.title",
  "examContentPages.seoTitle",
  "examContentPages.seoDescription",
  "examContentPages.description",
  "examContentPages.content",
  "examContentPages.faqItems",
  "examContentPages.source",
  "examContentPages.aiGeneratedAt",
  "examContentPages.publishedTitle",
  "examContentPages.publishedSeoTitle",
  "examContentPages.publishedSeoDescription",
  "examContentPages.publishedDescription",
  "examContentPages.publishedContent",
  "examContentPages.publishedFaqItems",
  "examContentPages.publishedAt",
  "examContentPages.reviewedByAdminId",
  "examContentPages.reviewedAt",
  "examContentPages.readyForReviewAt",
  "examContentPages.readyForReviewByAdminId",
  "examContentPages.updatedAt",
  "admins.fullName as reviewedByAdminName",
  "readyForReviewAdmins.fullName as readyForReviewByAdminName",
] as const;