import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchExamBySlugServer } from "../helpers/fetchExamBySlugServer";
import { fetchBundlesListServer } from "../helpers/fetchBundlesListServer";
import { fetchExamProductCountsServer } from "../helpers/fetchExamProductCountsServer";

// See exams.$examSlug.mock-tests.prefetch.ts for why this exists. Mirrors
// the queryKey/filters used by BundlesBody in ExamProductListingPage.tsx
// (examId/page/limit are numbers here, matching that hook's filters
// object exactly).
export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const examSlug = pathParts[pathParts.length - 2];

  if (!examSlug) return { statusCode: 404 };

  try {
    const exam = await qc.fetchQuery({
      queryKey: ["exam-detail", examSlug],
      queryFn: () => fetchExamBySlugServer(examSlug),
    });

    if (!exam) return { statusCode: 404 };

    const filters = { examId: exam.id, page: 1, limit: 12, sort: "popular" as const };
    await qc.prefetchQuery({
      queryKey: ["public", "bundles", filters],
      queryFn: () => fetchBundlesListServer(filters),
    });

    // ExamProductListingPage gates its ENTIRE render on
    // isExamFetching || isCountsFetching, so this must be prefetched too or
    // the page falls back to the top-level skeleton even with the list cached.
    await qc.prefetchQuery({
      queryKey: ["exam-products", "counts", examSlug],
      queryFn: () => fetchExamProductCountsServer(examSlug),
    });
  } catch (error) {
    console.error("Error prefetching exam bundles:", error);
  }

  return { maxAge: 300 };
};
