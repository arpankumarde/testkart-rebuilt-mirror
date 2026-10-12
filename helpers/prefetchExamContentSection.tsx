import type { QueryClient } from "@tanstack/query-core";
import { fetchExamContentServer } from "./fetchExamContentServer";
import { fetchExamProductCountsServer } from "./fetchExamProductCountsServer";
import {
  CUSTOM_PAGE_SLUG_PATTERN,
  EXAM_CONTENT_PAGE_META,
  EXAM_CONTENT_PAGE_TYPES,
  customPageType,
  type CustomExamPageType,
  type ExamContentPageType,
} from "./examContentTypes";

export type ExamSectionPrefetchResult = {
  maxAge?: number;
  statusCode?: number;
  redirect?: { to: string; permanent?: boolean };
};

const CACHE_SECONDS = 300;

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

// /exams/:examSlug/:segment -> the informational page it names, matching
// parseExamSection in components/ExamSectionLayout.tsx.
export function examSectionFromUrl(
  url: string
): { examSlug: string; segment: string; pageType: ExamContentPageType | CustomExamPageType | null } | null {
  const [root, rawExamSlug, segment] = new URL(url).pathname.split("/").filter(Boolean);
  if (root !== "exams" || !rawExamSlug || !segment) return null;
  const examSlug = decodeSegment(rawExamSlug);
  if (!examSlug) return null;
  const builtIn = EXAM_CONTENT_PAGE_TYPES.find((type) => EXAM_CONTENT_PAGE_META[type].slug === segment);
  if (builtIn) return { examSlug, segment, pageType: builtIn };
  if (CUSTOM_PAGE_SLUG_PATTERN.test(segment)) return { examSlug, segment, pageType: customPageType(segment) };
  return { examSlug, segment, pageType: null };
}

/**
 * SSR for the exam informational pages (syllabus, exam pattern, eligibility,
 * cut-off and admin-added custom pages). Seeds the same query keys that
 * ExamSectionLayout and ExamContentSiloPage read, so the served HTML carries
 * the header, Important Links, product tabs and section content.
 *
 * Unknown exam: 404. Exam exists but the section is not published (or the
 * custom slug is malformed): temporary redirect to the hub, as the page does
 * on the client.
 */
export async function prefetchExamContentSection(qc: QueryClient, url: string): Promise<ExamSectionPrefetchResult> {
  const section = examSectionFromUrl(url);
  if (!section) return { statusCode: 404, maxAge: CACHE_SECONDS };

  const { examSlug, pageType } = section;
  const hubPath = `/exams/${encodeURIComponent(examSlug)}`;
  if (!pageType) return { redirect: { to: hubPath, permanent: false } };

  try {
    const [data] = await Promise.all([
      qc.fetchQuery({
        queryKey: ["exam-content", examSlug, pageType],
        queryFn: () => fetchExamContentServer(examSlug, pageType),
      }),
      // Product tabs in the page header (ExamProductTabs).
      qc.prefetchQuery({
        queryKey: ["exam-products", "counts", examSlug],
        queryFn: () => fetchExamProductCountsServer(examSlug),
      }),
    ]);

    if (!data) return { statusCode: 404, maxAge: CACHE_SECONDS };
    if (!data.page) return { redirect: { to: hubPath, permanent: false } };
    return { maxAge: CACHE_SECONDS };
  } catch (error) {
    console.error("Error prefetching exam section:", error);
    // Not cached, so a transient database failure is not served for five minutes.
    return { maxAge: 0 };
  }
}
