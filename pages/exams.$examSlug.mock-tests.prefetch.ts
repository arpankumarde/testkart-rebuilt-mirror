import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchExamBySlugServer } from "../helpers/fetchExamBySlugServer";
import { fetchTestsListServer } from "../helpers/fetchTestsListServer";
import { fetchExamProductCountsServer } from "../helpers/fetchExamProductCountsServer";

// This route, along with the sibling .courses/.study-notes/.bundles routes,
// shares the ExamProductListingPage component and previously had no SSR
// prefetch at all — the entire product grid was client-rendered only.
// With ~1,700 exams x 4 product types, that's thousands of URLs a crawler
// could only see as an empty shell. This mirrors the queryKey/filters used
// by MockTestsBody in components/ExamProductListingPage.tsx exactly, so the
// client hydrates from cache instead of re-fetching.
export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  // /exams/:examSlug/mock-tests
  const examSlug = pathParts[pathParts.length - 2];

  if (!examSlug) return { statusCode: 404 };

  try {
    const exam = await qc.fetchQuery({
      queryKey: ["exam-detail", examSlug],
      queryFn: () => fetchExamBySlugServer(examSlug),
    });

    if (!exam) return { statusCode: 404 };

    const filters = { examId: String(exam.id), sortBy: "popular" as const, page: "1", limit: "12" };
    await qc.prefetchQuery({
      queryKey: ["tests", "list", filters],
      queryFn: () => fetchTestsListServer(filters),
    });

    // ExamProductListingPage gates its ENTIRE render on
    // isExamFetching || isCountsFetching, so this must be prefetched too or
    // the page falls back to the top-level skeleton even with the list cached.
    await qc.prefetchQuery({
      queryKey: ["exam-products", "counts", examSlug],
      queryFn: () => fetchExamProductCountsServer(examSlug),
    });
  } catch (error) {
    console.error("Error prefetching exam mock tests:", error);
  }

  return { maxAge: 300 };
};
