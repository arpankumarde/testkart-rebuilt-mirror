import { db } from "./db";
import { EXAM_CONTENT_PAGE_META, EXAM_CONTENT_PAGE_TYPES, customPageType } from "./examContentTypes";
import { examProductPageMeta, type ExamProductType } from "./examProductPageMeta";
import type { ContentReportTarget } from "./contentReportTypes";

export type ResolvedContent = { contentId: number | null; title: string | null };

const NONE: ResolvedContent = { contentId: null, title: null };

const examPageType = (segment: string): string => {
  const builtIn = EXAM_CONTENT_PAGE_TYPES.find((type) => EXAM_CONTENT_PAGE_META[type].slug === segment);
  if (builtIn) return builtIn;
  if (Object.prototype.hasOwnProperty.call(examProductPageMeta, segment)) {
    return examProductPageMeta[segment as ExamProductType].contentPageType;
  }
  return customPageType(segment);
};

/**
 * Looks up the database row behind a reported page so the admin list can link a report to its
 * content. Best effort: an unknown slug or a failed lookup leaves the id empty and the report is
 * still stored with its URL and slug.
 */
export async function resolveReportedContent(reported: ContentReportTarget): Promise<ResolvedContent> {
  const { contentType, slug, parentSlug } = reported;
  if (!slug) return NONE;
  try {
    switch (contentType) {
      case "exam": {
        const row = await db
          .selectFrom("exams")
          .select(["id", "examName", "fullName"])
          .where("examSlug", "=", slug)
          .executeTakeFirst();
        return row ? { contentId: row.id, title: row.fullName || row.examName } : NONE;
      }
      case "exam_page": {
        if (!parentSlug) return NONE;
        const exam = await db
          .selectFrom("exams")
          .select(["id", "examName"])
          .where("examSlug", "=", parentSlug)
          .executeTakeFirst();
        if (!exam) return NONE;
        const page = await db
          .selectFrom("examContentPages")
          .select(["id", "title"])
          .where("examId", "=", exam.id)
          .where("pageType", "=", examPageType(slug))
          .executeTakeFirst();
        return page ? { contentId: page.id, title: page.title || exam.examName } : { contentId: null, title: exam.examName };
      }
      case "blog_post":
      case "help_article": {
        const row = await db
          .selectFrom("blogPosts")
          .select(["id", "title"])
          .where("slug", "=", slug)
          .where("type", "=", contentType === "blog_post" ? "blog" : "knowledge_base")
          .executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      case "current_affairs": {
        const candidates = parentSlug ? [slug, `${parentSlug}/${slug}`] : [slug];
        const row = await db
          .selectFrom("currentAffairsPosts")
          .select(["id", "title"])
          .where("slug", "in", candidates)
          .orderBy("id", "desc")
          .executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      case "exam_news": {
        const row = await db.selectFrom("examNewsPosts").select(["id", "title"]).where("slug", "=", slug).executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      case "glossary_term": {
        const row = await db.selectFrom("glossaryTerms").select(["id", "term"]).where("slug", "=", slug).executeTakeFirst();
        return row ? { contentId: row.id, title: row.term } : NONE;
      }
      case "course": {
        const row = await db.selectFrom("courses").select(["id", "title"]).where("slug", "=", slug).executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      case "study_note": {
        const row = await db.selectFrom("digitalProducts").select(["id", "title"]).where("slug", "=", slug).executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      case "mock_test": {
        const row = await db.selectFrom("mockTests").select(["id", "title"]).where("slug", "=", slug).executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      case "live_test": {
        const row = await db
          .selectFrom("liveTests")
          .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
          .select(["liveTests.id", "liveTests.title"])
          .where("mockTests.slug", "=", slug)
          .orderBy("liveTests.id", "desc")
          .executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      case "bundle": {
        const row = await db.selectFrom("courseBundles").select(["id", "title"]).where("slug", "=", slug).executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      case "masterclass": {
        const row = await db.selectFrom("masterclasses").select(["id", "title"]).where("slug", "=", slug).executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      case "press": {
        const row = await db.selectFrom("newsCoverage").select(["id", "title"]).where("slug", "=", slug).executeTakeFirst();
        return row ? { contentId: row.id, title: row.title } : NONE;
      }
      default:
        return NONE;
    }
  } catch (error) {
    console.error("Reported content lookup failed:", error);
    return NONE;
  }
}