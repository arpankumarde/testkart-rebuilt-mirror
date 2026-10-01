import { db } from "./db";
import {
  customPageSlug,
  customPageType,
  type CustomExamPageType,
  type ExamCustomPage,
  type ExamSectionPageType,
  isCustomPageType,
} from "./examContentTypes";

// Backend-only: reads exam_custom_pages, the per-exam list of admin-added
// pages. Their content rows live in exam_content_pages under "custom:<slug>".
export const examCustomPages = {
  // In sidebar order: sort order, then creation order.
  async list(examId: number): Promise<ExamCustomPage[]> {
    const rows = await db
      .selectFrom("examCustomPages")
      .select(["id", "slug", "label"])
      .where("examId", "=", examId)
      .orderBy("sortOrder", "asc")
      .orderBy("id", "asc")
      .execute();
    return rows.map((row) => ({ ...row, pageType: customPageType(row.slug) }));
  },

  async find(examId: number, pageType: CustomExamPageType): Promise<ExamCustomPage | undefined> {
    const row = await db
      .selectFrom("examCustomPages")
      .select(["id", "slug", "label"])
      .where("examId", "=", examId)
      .where("slug", "=", customPageSlug(pageType))
      .executeTakeFirst();
    return row ? { ...row, pageType } : undefined;
  },

  // A content row may only be written for a built-in section or a custom page
  // that still exists - otherwise an orphan "custom:x" row could be created.
  async assertWritable(examId: number, pageType: ExamSectionPageType): Promise<ExamCustomPage | null> {
    if (!isCustomPageType(pageType)) return null;
    const page = await examCustomPages.find(examId, pageType);
    if (!page) throw new Error("That custom page no longer exists.");
    return page;
  },
};
