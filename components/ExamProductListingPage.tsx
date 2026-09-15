import React, { useCallback, useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { SEOHead } from "./SEOHead";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import { TeacherProductCard } from "./HomepageContentSection";
import { BundlesGrid } from "./BundlesGrid";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./Accordion";
import { ExamPageNav } from "./ExamPageNav";
import { ShareButton } from "./ShareButton";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";

import { useExamDetailQuery } from "../helpers/useExamDetail";
import { useExamProductCountsQuery } from "../helpers/useExamProductCounts";
import { useTestsQuery } from "../helpers/useTestsQuery";
import { useShopProductsQuery } from "../helpers/useShopQuery";
import { usePublicCoursesQuery } from "../helpers/useStudentCoursesQuery";
import { useBundlesQuery } from "../helpers/useBundlesQuery";
import { Placeholder } from "../helpers/placeholderImages";
import { formatItemPrice } from "../helpers/homepageItemUtils";
import { wrapContentTables } from "../helpers/contentTables";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { getPublicExamContent } from "../endpoints/exam-content/get_GET.schema";
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from "../helpers/shareLinks";
import type { AdminExamSectionType } from "../helpers/examContentTypes";
import type { ExamProductCounts } from "../endpoints/exam-products/counts_GET.schema";
import type { InputType as TestsInputType } from "../endpoints/tests/list_GET.schema";
import type { InputType as CoursesInputType } from "../endpoints/courses/list_GET.schema";

import styles from "./ExamProductListingPage.module.css";

export type ExamProductType = "mock-tests" | "courses" | "study-notes" | "bundles";

const DOMAIN = "https://testkart.in";
const ITEMS_PER_PAGE = 12;

const PRODUCT_TYPE_META: Record<
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
    // see EmptyProductState below.
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

const CARD_SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "popular", label: "Most Popular" },
];

function getPageNumbers(page: number, totalPages: number): (number | string)[] {
  const delta = 1;
  const range: number[] = [];
  const rangeWithDots: (number | string)[] = [];
  let l: number | undefined;

  range.push(1);
  for (let i = page - delta; i <= page + delta; i++) {
    if (i < totalPages && i > 1) range.push(i);
  }
  if (totalPages > 1) range.push(totalPages);

  for (const i of range) {
    if (l !== undefined) {
      if (i - l === 2) rangeWithDots.push(l + 1);
      else if (i - l !== 1) rangeWithDots.push("...");
    }
    rangeWithDots.push(i);
    l = i;
  }
  return rangeWithDots;
}

const CardSkeletonGrid: React.FC = () => (
  <div className={styles.grid}>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className={styles.skeletonCard}>
        <div className={styles.skeletonCardHeader}>
          <Skeleton style={{ width: 36, height: 36, borderRadius: "50%" }} />
          <div className={styles.skeletonCardHeaderText}>
            <Skeleton style={{ height: 14, width: 100 }} />
            <Skeleton style={{ height: 12, width: 150 }} />
          </div>
        </div>
        <Skeleton style={{ height: 20, width: "100%", marginBottom: "var(--spacing-3)" }} />
        <Skeleton style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "var(--radius)" }} />
      </div>
    ))}
  </div>
);

const PaginationBar: React.FC<{
  page: number;
  totalPages: number;
  totalCount: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}> = ({ page, totalPages, totalCount, itemLabel, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className={styles.paginationContainer}>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => page > 1 && onPageChange(page - 1)}
              className={page <= 1 ? styles.disabledLink : ""}
            />
          </PaginationItem>
          {getPageNumbers(page, totalPages).map((pageNum, index) => (
            <PaginationItem key={index}>
              {pageNum === "..." ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink isActive={page === pageNum} onClick={() => onPageChange(pageNum as number)}>
                  {pageNum}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              onClick={() => page < totalPages && onPageChange(page + 1)}
              className={page >= totalPages ? styles.disabledLink : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <div className={styles.paginationInfo}>
        Page {page} of {totalPages} &mdash; {totalCount} {itemLabel}
      </div>
    </div>
  );
};

const SortBar: React.FC<{
  sortBy: string;
  onSortChange: (v: string) => void;
  options?: { value: string; label: string }[];
}> = ({ sortBy, onSortChange, options = CARD_SORT_OPTIONS }) => (
  <div className={styles.sortBar}>
    <label className={styles.sortLabel}>Sort by:</label>
    <Select value={sortBy} onValueChange={onSortChange}>
      <SelectTrigger className={styles.sortTrigger}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

// When an exam has zero items of a given product type, this renders instead
// of a blank "nothing here" line. It exists because these zero-inventory
// exam pages (e.g. /exams/some-exam/mock-tests with no tagged tests) were
// showing up in SEO audits under BOTH "no body content" and "few internal
// links" — same root cause, empty inventory — so the fix adds real body
// copy plus links to sibling product types for this exam, the general
// marketplace for this product type, and the exams directory.
const EmptyProductState: React.FC<{ productType: ExamProductType; examName: string }> = ({ productType, examName }) => {
  const { examSlug } = useParams<{ examSlug: string }>();
  const hubUrl = `/exams/${examSlug}`;
  const meta = PRODUCT_TYPE_META[productType];
  const otherTypes = (Object.keys(PRODUCT_TYPE_META) as ExamProductType[]).filter((t) => t !== productType);

  return (
    <div className={styles.stateContainer}>
      <p>
        There are no {meta.label.toLowerCase()} published for {examName} yet. New content is added
        regularly as teachers create it — check back soon, or explore these alternatives in the
        meantime:
      </p>
      <ul className={styles.emptyStateLinks}>
        {otherTypes.map((type) => (
          <li key={type}>
            <Link to={`${hubUrl}/${type}`}>
              {PRODUCT_TYPE_META[type].label} for {examName}
            </Link>
          </li>
        ))}
        <li>
          <Link to={meta.browsePath}>Browse all {meta.label.toLowerCase()} on Testkart</Link>
        </li>
        <li>
          <Link to="/exams">Explore other exams</Link>
        </li>
      </ul>
    </div>
  );
};

// --- Per-type listing bodies -------------------------------------------------
// Each body owns its own hook call, sort/page state, and rendering — kept as
// separate components (rather than branching which hook to call inside one
// component) so React's rules of hooks are never in question.

const MockTestsBody: React.FC<{ examId: number; examName: string }> = ({ examId, examName }) => {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<TestsInputType["sortBy"]>("popular");

  const filters = useMemo(
    () => ({ examId: String(examId), sortBy, page: page.toString(), limit: ITEMS_PER_PAGE.toString() }),
    [examId, sortBy, page]
  );
  const { data, isFetching } = useTestsQuery(filters);

  const handleSortChange = useCallback((v: string) => {
    setSortBy(v as TestsInputType["sortBy"]);
    setPage(1);
  }, []);

  if (isFetching && !data) return <CardSkeletonGrid />;
  if (!data || data.tests.length === 0) {
    return <EmptyProductState productType="mock-tests" examName={examName} />;
  }

  return (
    <>
      <SortBar
        sortBy={sortBy || "popular"}
        onSortChange={handleSortChange}
        options={[...CARD_SORT_OPTIONS, { value: "rating", label: "Highest Rated" }]}
      />
      <div className={styles.grid}>
        {data.tests.map((test) => (
          <TeacherProductCard
            key={test.id}
            link={`/mock-test/${test.slug}`}
            teacherName={test.teacherName}
            teacherAvatarUrl={test.teacherAvatarUrl}
            teacherTagline={test.teacherTagline}
            teacherYearsOfExperience={test.teacherYearsOfExperience}
            teacherSlug={test.teacherSlug}
            teacherIsVerified={test.teacherIsVerified}
            productTitle={test.title}
            examName={test.examName}
            stats={`${(test.views ?? 0).toLocaleString("en-IN")} views${test.rating != null ? ` · ⭐ ${test.rating.toFixed(2)}` : ""}`}
            priceLabel={formatItemPrice(test.price, test.discountPrice)}
            isFree={(test.discountPrice ?? test.price) === 0}
            thumbnailUrl={test.thumbnailUrl}
            placeholderUrl={Placeholder.TEST}
          />
        ))}
      </div>
      <PaginationBar
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        totalCount={data.pagination.totalCount}
        itemLabel="tests"
        onPageChange={setPage}
      />
    </>
  );
};

const StudyNotesBody: React.FC<{ examId: number; examName: string }> = ({ examId, examName }) => {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "popular" | "price_asc" | "price_desc">("popular");

  const { data, isFetching } = useShopProductsQuery({ examId, page, limit: ITEMS_PER_PAGE, sort });

  const handleSortChange = useCallback((v: string) => {
    setSort(v as typeof sort);
    setPage(1);
  }, []);

  if (isFetching && !data) return <CardSkeletonGrid />;
  if (!data || data.products.length === 0) {
    return <EmptyProductState productType="study-notes" examName={examName} />;
  }

  return (
    <>
      <SortBar sortBy={sort} onSortChange={handleSortChange} />
      <div className={styles.grid}>
        {data.products.map((product) => (
          <TeacherProductCard
            key={product.id}
            link={`/study-notes/${product.slug}`}
            teacherName={product.teacherName}
            teacherAvatarUrl={product.teacherAvatar}
            teacherTagline={product.teacherTagline}
            teacherYearsOfExperience={product.teacherYearsOfExperience}
            teacherSlug={product.teacherSlug}
            teacherIsVerified={product.teacherIsVerified}
            productTitle={product.title}
            examName={product.examName}
            stats={[
              `${product.views.toLocaleString("en-IN")} views`,
              product.pageCount ? `${product.pageCount} pages` : null,
              product.fileCount > 1 ? `${product.fileCount} files` : null,
            ].filter(Boolean).join(" · ")}
            priceLabel={formatItemPrice(product.price)}
            isFree={product.price === 0}
            // Study note / digital product thumbnails are discontinued
            // site-wide — never pass thumbnailUrl/placeholderUrl here.
            // See the note on TeacherProductCard in HomepageContentSection.tsx.
          />
        ))}
      </div>
      <PaginationBar
        page={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        itemLabel="products"
        onPageChange={setPage}
      />
    </>
  );
};

const CoursesBody: React.FC<{ examId: number; examName: string }> = ({ examId, examName }) => {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<CoursesInputType["sortBy"]>("popular");

  const filters = useMemo(
    () => ({ examId: String(examId), sortBy, page: page.toString(), limit: ITEMS_PER_PAGE.toString() }),
    [examId, sortBy, page]
  );
  const { data, isFetching } = usePublicCoursesQuery(filters);

  const handleSortChange = useCallback((v: string) => {
    setSortBy(v as CoursesInputType["sortBy"]);
    setPage(1);
  }, []);

  if (isFetching && !data) return <CardSkeletonGrid />;
  if (!data || data.courses.length === 0) {
    return <EmptyProductState productType="courses" examName={examName} />;
  }

  return (
    <>
      <SortBar sortBy={sortBy || "popular"} onSortChange={handleSortChange} />
      <div className={styles.grid}>
        {data.courses.map((course) => (
          <TeacherProductCard
            key={course.id}
            link={`/course/${course.slug}`}
            teacherName={course.teacherName}
            teacherAvatarUrl={course.teacherAvatarUrl}
            teacherTagline={course.teacherTagline}
            teacherYearsOfExperience={course.teacherYearsOfExperience}
            teacherSlug={course.teacherSlug}
            teacherIsVerified={course.teacherIsVerified}
            productTitle={course.title}
            stats={`${course.views.toLocaleString("en-IN")} views`}
            priceLabel={formatItemPrice(course.price)}
            isFree={course.price === 0}
            thumbnailUrl={course.thumbnailImageUrl || course.thumbnailUrl}
            placeholderUrl={Placeholder.COURSE}
          />
        ))}
      </div>
      <PaginationBar
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        totalCount={data.pagination.totalCount}
        itemLabel="courses"
        onPageChange={setPage}
      />
    </>
  );
};

const BundlesBody: React.FC<{ examId: number; examName: string }> = ({ examId, examName }) => {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "popular" | "price_asc" | "price_desc">("popular");

  const { data, isFetching } = useBundlesQuery({ examId, page, limit: ITEMS_PER_PAGE, sort });

  const handleSortChange = useCallback((v: string) => {
    setSort(v as typeof sort);
    setPage(1);
  }, []);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  if (isFetching && !data) {
    return (
      <div className={styles.grid}>
        <BundlesGrid bundles={[]} isLoading={true} />
      </div>
    );
  }
  if (!data || data.bundles.length === 0) {
    return <EmptyProductState productType="bundles" examName={examName} />;
  }

  return (
    <>
      <SortBar sortBy={sort} onSortChange={handleSortChange} />
      <BundlesGrid bundles={data.bundles} isLoading={false} />
      <PaginationBar
        page={data.page}
        totalPages={totalPages}
        totalCount={data.total}
        itemLabel="bundles"
        onPageChange={setPage}
      />
    </>
  );
};

// --- Main shell ---------------------------------------------------------

interface ExamProductListingPageProps {
  productType: ExamProductType;
}

export const ExamProductListingPage: React.FC<ExamProductListingPageProps> = ({ productType }) => {
  const { examSlug } = useParams<{ examSlug: string }>();
  const meta = PRODUCT_TYPE_META[productType];

  const { data: examDetail, isFetching: isExamFetching } = useExamDetailQuery(examSlug);
  const { data: countsData, isFetching: isCountsFetching } = useExamProductCountsQuery(examSlug);

  // Optional admin-authored title/description/content/FAQ overlay for this
  // listing page — same CMS the exam hub's Overview section uses. Falls
  // back to the hardcoded defaults below when nothing's been published;
  // never gates whether the page itself exists (that's the product count).
  const { data: contentData } = useQuery({
    queryKey: ["exam-content", examSlug, meta.contentPageType],
    queryFn: () => getPublicExamContent({ examSlug: examSlug as string, pageType: meta.contentPageType }),
    enabled: !!examSlug,
    staleTime: 5 * 60 * 1000,
  });
  const pageContent = contentData?.page ?? null;

  const isLoading = isExamFetching || isCountsFetching;

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.breadcrumbSkeleton}>
          <Skeleton style={{ width: "220px", height: "16px" }} />
        </div>
        <div className={styles.heroSkeleton}>
          <Skeleton style={{ width: "60%", height: "32px", marginBottom: "var(--spacing-3)" }} />
          <Skeleton style={{ width: "40%", height: "16px" }} />
        </div>
        <CardSkeletonGrid />
      </div>
    );
  }

  if (!examDetail) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.stateContainer}>
          <h2>Exam Not Found</h2>
          <p>We couldn't find the exam you're looking for.</p>
          <Button asChild variant="primary">
            <Link to="/exams">Browse All Exams</Link>
          </Button>
        </div>
      </div>
    );
  }

  const hubUrl = `/exams/${examDetail.examSlug}`;
  const examLabel = examDetail.fullName || examDetail.examName;

  // No products of this type — never a live URL for an empty type. Same
  // pattern as ExamContentSiloPage's redirect for unpublished content
  // sections: no 404, no blank grid, straight back to the hub.
  const count = countsData?.counts[meta.countKey] ?? 0;
  if (count === 0) {
    return <Navigate to={hubUrl} replace />;
  }

  const canonicalUrl = `${DOMAIN}${hubUrl}/${productType}`;
  // Admin-authored title/description win when published; otherwise fall
  // back to the generated defaults — the page renders either way.
  const pageTitle = pageContent?.title || `${examLabel} ${meta.label}`;
  const pageDescription = pageContent?.description || meta.description(examLabel);
  const seoTitle = pageContent?.seoTitle || pageTitle;
  const seoDescription = pageContent?.seoDescription || pageDescription;
  const pageFaqItems = pageContent?.faqItems ?? [];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: DOMAIN },
          { "@type": "ListItem", position: 2, name: "Exams", item: `${DOMAIN}/exams` },
          { "@type": "ListItem", position: 3, name: examLabel, item: `${DOMAIN}${hubUrl}` },
          { "@type": "ListItem", position: 4, name: meta.label, item: canonicalUrl },
        ],
      },
      {
        "@type": "CollectionPage",
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
      },
      ...(pageFaqItems.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: pageFaqItems.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: { "@type": "Answer", text: item.answer },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div className={styles.pageContainer}>
      <SEOHead title={seoTitle} description={seoDescription} url={canonicalUrl} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/" className={styles.breadcrumbLink}>Home</Link>
        <ChevronRight size={14} className={styles.breadcrumbSeparator} />
        <Link to="/exams" className={styles.breadcrumbLink}>Exams</Link>
        <ChevronRight size={14} className={styles.breadcrumbSeparator} />
        <Link to={hubUrl} className={styles.breadcrumbLink}>{examLabel}</Link>
        <ChevronRight size={14} className={styles.breadcrumbSeparator} />
        <span className={styles.breadcrumbCurrent}>{meta.label}</span>
      </nav>

      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>{pageTitle}</h1>
        <p className={styles.heroDescription}>{pageDescription}</p>
        <div className={styles.heroActions}>
          <ShareButton
            kind="exam-page"
            handle={`${examDetail.examSlug}/${productType}`}
            title={pageTitle}
            campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
          />
        </div>
      </header>

      <ExamPageNav
        examSlug={examDetail.examSlug}
        currentSlug={productType}
        publishedPageTypes={contentData?.publishedPageTypes ?? []}
        className={styles.subNav}
      />

      <main className={styles.mainContent}>
        {productType === "mock-tests" && <MockTestsBody examId={examDetail.id} examName={examDetail.examName} />}
        {productType === "study-notes" && <StudyNotesBody examId={examDetail.id} examName={examDetail.examName} />}
        {productType === "courses" && <CoursesBody examId={examDetail.id} examName={examDetail.examName} />}
        {productType === "bundles" && <BundlesBody examId={examDetail.id} examName={examDetail.examName} />}
      </main>

      {pageContent?.content && pageContent.content.trim().length > 0 && (
        <section
          className={styles.additionalContent}
          dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(pageContent.content)) }}
        />
      )}

      {pageFaqItems.length > 0 && (
        <section className={styles.faqSection}>
          <h2 className={styles.faqSectionTitle}>Frequently Asked Questions</h2>
          <Accordion type="single" collapsible>
            {pageFaqItems.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className={styles.faqTrigger}>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}
    </div>
  );
};
