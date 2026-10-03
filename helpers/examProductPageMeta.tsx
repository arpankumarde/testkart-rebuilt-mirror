import type { AdminExamSectionType } from "./examContentTypes";
import type { ExamProductCounts } from "../endpoints/exam-products/counts_GET.schema";

// The 4 exam product listing pages (/exams/:examSlug/mock-tests, ...). Used by
// ExamProductListingPage for the page itself and by ExamSectionLayout for
// the breadcrumb and header around it.
export type ExamProductType = "mock-tests" | "courses" | "study-notes" | "bundles";

export const examProductPageMeta: Record<
  ExamProductType,
  {
    label: string;
    countKey: keyof ExamProductCounts;
    // The matching exam-content-pages pageType used to fetch the optional
    // admin-authored title/description/content/FAQ overlay for this page.
    contentPageType: AdminExamSectionType;
    description: (examLabel: string) => string;
    // General (non-exam-scoped) marketplace page for this product type,
    // used as a real link out when this exam currently has zero items —
    // see EmptyProductState in ExamProductListingPage.
    browsePath: string;
  }
> = {
  "mock-tests": {
    label: "Mock Tests",
    countKey: "mockTests",
    contentPageType: "mock_tests",
    description: (examLabel) => `Practice with mock tests built specifically for ${examLabel}.`,
    browsePath: "/mock-test",
  },
  courses: {
    label: "Courses",
    countKey: "courses",
    contentPageType: "courses",
    description: (examLabel) => `Structured courses to help you prepare for ${examLabel}.`,
    browsePath: "/course",
  },
  "study-notes": {
    label: "Study Notes",
    countKey: "digitalProducts",
    contentPageType: "study_notes",
    description: (examLabel) => `Notes, PDFs, and study material curated for ${examLabel}.`,
    browsePath: "/study-notes",
  },
  bundles: {
    label: "Bundles",
    countKey: "bundles",
    contentPageType: "bundles",
    description: (examLabel) => `Save more with bundled test series and courses for ${examLabel}.`,
    browsePath: "/bundles",
  },
};
