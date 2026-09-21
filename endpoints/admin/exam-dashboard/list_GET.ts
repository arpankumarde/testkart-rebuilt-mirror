import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  type OutputType,
  type ExamDashboardRow,
  type ContentSectionStatus,
  type DataHealthFlag,
} from "./list_GET.schema";
import {
  ADMIN_EXAM_SECTION_TYPES,
  type AdminExamSectionType,
} from "../../../helpers/examContentTypes";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const [exams, categories, contentPages, contentIssues, mockTestCounts, digitalProductCounts] =
      await Promise.all([
        db.selectFrom("exams").selectAll().execute(),
        db
          .selectFrom("examCategories")
          .select(["id", "categoryName"])
          .orderBy("categoryName", "asc")
          .execute(),
        db
          .selectFrom("examContentPages")
          .select(["examId", "pageType", "status", "readyForReviewAt", "updatedAt"])
          .execute(),
        // The Content dashboard's exam page queues, per exam. Keep each condition
        // identical to endpoints/admin/content/dashboard_GET.ts so a tile's count
        // equals the page types listed here.
        db
          .selectFrom("examContentPages")
          .select("examId")
          .select([
            sql<string[]>`coalesce(array_agg(page_type::text) FILTER (
              WHERE published_at IS NOT NULL AND published_content IS DISTINCT FROM content
            ), '{}')`.as("unpublishedEditTypes"),
            sql<string[]>`coalesce(array_agg(page_type::text) FILTER (
              WHERE status = 'published' AND page_type <> 'overview'
              AND (seo_title IS NULL OR seo_title = '' OR seo_description IS NULL OR seo_description = '')
            ), '{}')`.as("missingSeoTypes"),
            sql<string[]>`coalesce(array_agg(page_type::text) FILTER (
              WHERE status = 'published' AND (faq_items IS NULL OR faq_items::text IN ('null', '[]', '{}'))
            ), '{}')`.as("missingFaqTypes"),
          ])
          .groupBy("examId")
          .execute(),
        db
          .selectFrom("mockTests")
          .select(["examId"])
          .select((eb) => eb.fn.countAll().as("count"))
          .where("examId", "is not", null)
          .where("deletedAt", "is", null)
          .groupBy("examId")
          .execute(),
        db
          .selectFrom("digitalProducts")
          .select(["examId"])
          .select((eb) => eb.fn.countAll().as("count"))
          .where("examId", "is not", null)
          .groupBy("examId")
          .execute(),
      ]);

    const categoryNameById = new Map(categories.map((c) => [c.id, c.categoryName]));
    const mockTestCountByExam = new Map(
      mockTestCounts
        .filter((row): row is typeof row & { examId: number } => row.examId !== null)
        .map((row) => [row.examId, Number(row.count)])
    );
    const digitalProductCountByExam = new Map(
      digitalProductCounts
        .filter((row): row is typeof row & { examId: number } => row.examId !== null)
        .map((row) => [row.examId, Number(row.count)])
    );
    const contentIssuesByExam = new Map(contentIssues.map((row) => [row.examId, row]));
    const inSectionOrder = (types: string[] | undefined): AdminExamSectionType[] =>
      types ? ADMIN_EXAM_SECTION_TYPES.filter((type) => types.includes(type)) : [];

    const pagesByExam = new Map<number, typeof contentPages>();
    for (const page of contentPages) {
      const list = pagesByExam.get(page.examId);
      if (list) {
        list.push(page);
      } else {
        pagesByExam.set(page.examId, [page]);
      }
    }

    // Data-health: find duplicate exam names / slugs across the whole catalog.
    const nameCounts = new Map<string, number>();
    const slugCounts = new Map<string, number>();
    for (const exam of exams) {
      const nameKey = exam.examName.trim().toLowerCase();
      const slugKey = exam.examSlug.trim().toLowerCase();
      nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1);
      slugCounts.set(slugKey, (slugCounts.get(slugKey) ?? 0) + 1);
    }

    const rows: ExamDashboardRow[] = exams.map((exam) => {
      const pages = pagesByExam.get(exam.id) ?? [];
      const contentStatusByType = {} as Record<AdminExamSectionType, ContentSectionStatus>;
      const readyForReviewTypes: AdminExamSectionType[] = [];
      let publishedSectionCount = 0;
      let lastContentUpdatedAt: Date | null = null;

      for (const type of ADMIN_EXAM_SECTION_TYPES) {
        const page = pages.find((p) => p.pageType === type);
        const status: ContentSectionStatus = !page
          ? "none"
          : page.status === "published"
          ? "published"
          : "draft";
        contentStatusByType[type] = status;
        if (status === "published") publishedSectionCount += 1;
        if (page?.readyForReviewAt) readyForReviewTypes.push(type);
        if (page?.updatedAt) {
          const updated = new Date(page.updatedAt);
          if (!lastContentUpdatedAt || updated > lastContentUpdatedAt) {
            lastContentUpdatedAt = updated;
          }
        }
      }

      const dataHealthFlags: DataHealthFlag[] = [];
      if ((nameCounts.get(exam.examName.trim().toLowerCase()) ?? 0) > 1) {
        dataHealthFlags.push("duplicate-name");
      }
      if ((slugCounts.get(exam.examSlug.trim().toLowerCase()) ?? 0) > 1) {
        dataHealthFlags.push("duplicate-slug");
      }
      if (!exam.fullName || exam.fullName.trim().length === 0) {
        dataHealthFlags.push("missing-full-name");
      }
      if (!exam.description || exam.description.trim().length === 0) {
        dataHealthFlags.push("missing-description");
      }

      const mockTestCount = mockTestCountByExam.get(exam.id) ?? 0;
      const digitalProductCount = digitalProductCountByExam.get(exam.id) ?? 0;
      const issues = contentIssuesByExam.get(exam.id);

      return {
        ...exam,
        categoryName: categoryNameById.get(exam.categoryId) ?? "Uncategorized",
        contentStatusByType,
        readyForReviewTypes,
        unpublishedEditTypes: inSectionOrder(issues?.unpublishedEditTypes),
        missingSeoTypes: inSectionOrder(issues?.missingSeoTypes),
        missingFaqTypes: inSectionOrder(issues?.missingFaqTypes),
        publishedSectionCount,
        totalSectionCount: ADMIN_EXAM_SECTION_TYPES.length,
        lastContentUpdatedAt,
        dataHealthFlags,
        mockTestCount,
        digitalProductCount,
        totalProductCount: mockTestCount + digitalProductCount,
      };
    });

    return new Response(
      superjson.stringify({ rows, categories } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-dashboard/list_GET] Error fetching dashboard:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
