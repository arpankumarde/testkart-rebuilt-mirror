import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchExamBySlugServer } from "../helpers/fetchExamBySlugServer";
import { fetchTestsListServer } from "../helpers/fetchTestsListServer";
import { fetchShopProductsListServer } from "../helpers/fetchShopProductsListServer";
import { fetchCoursesListServer } from "../helpers/fetchCoursesListServer";
import { fetchBundlesListServer } from "../helpers/fetchBundlesListServer";
import { fetchExamProductCountsServer } from "../helpers/fetchExamProductCountsServer";

const PREVIEW_LIMIT = 4;

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/");
  const examSlug = pathParts[pathParts.length - 1];

  if (!examSlug) {
    return { maxAge: 300 };
  }

  try {
    const exam = await qc.fetchQuery({
      queryKey: ["exam-detail", examSlug],
      queryFn: () => fetchExamBySlugServer(examSlug),
    });

    if (exam) {
      // ExamProductsSection (the "Study Material" preview block rendered in
      // <main> on this page) gates its ENTIRE render on 4 separate queries
      // (tests/shop/courses/bundles) all finishing — previously none of
      // them were prefetched here, so this section always shipped its
      // loading-skeleton HTML with zero text, on every exam hub page.
      // Filters below must match ExamProductsSection.tsx exactly.
      const testsFilters = { examId: String(exam.id), limit: String(PREVIEW_LIMIT), sortBy: "popular" as const };
      const shopFilters = { examId: exam.id, limit: PREVIEW_LIMIT, page: 1, sort: "popular" as const };
      const coursesFilters = { examId: String(exam.id), limit: String(PREVIEW_LIMIT), sortBy: "popular" as const };
      const bundlesFilters = { examId: exam.id, limit: PREVIEW_LIMIT, sort: "popular" as const };

      await Promise.all([
        qc.prefetchQuery({
          queryKey: ["tests", "list", testsFilters],
          queryFn: () => fetchTestsListServer(testsFilters),
        }),
        qc.prefetchQuery({
          queryKey: ["shop", "products", shopFilters],
          queryFn: () => fetchShopProductsListServer(shopFilters),
        }),
        qc.prefetchQuery({
          queryKey: ["public", "courses", coursesFilters],
          queryFn: () => fetchCoursesListServer(coursesFilters),
        }),
        qc.prefetchQuery({
          queryKey: ["public", "bundles", bundlesFilters],
          queryFn: () => fetchBundlesListServer(bundlesFilters),
        }),
        // Product pills in ExamPageNav; key matches useExamProductCountsQuery.
        qc.prefetchQuery({
          queryKey: ["exam-products", "counts", examSlug],
          queryFn: () => fetchExamProductCountsServer(examSlug),
        }),
      ]);
    }
  } catch (error) {
    console.error("Error prefetching exam hub page:", error);
  }

  // Cache for 5 minutes
  return { maxAge: 300 };
};
