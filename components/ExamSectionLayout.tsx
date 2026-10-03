import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { ExamPageShell } from "./ExamPageShell";
import { ExamPageHeader } from "./ExamPageHeader";
import { ExamProductTabs } from "./ExamPageNav";
import { ShareButton } from "./ShareButton";
import { ExamContentExportButton } from "./ExamContentExportButton";
import { getPublicExamContent } from "../endpoints/exam-content/get_GET.schema";
import { useExamDetailQuery } from "../helpers/useExamDetail";
import { useExamProductCountsQuery } from "../helpers/useExamProductCounts";
import { examProductPageMeta, type ExamProductType } from "../helpers/examProductPageMeta";
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from "../helpers/shareLinks";
import {
  CUSTOM_PAGE_SLUG_PATTERN,
  EXAM_CONTENT_PAGE_META,
  EXAM_CONTENT_PAGE_TYPES,
  customPageSlug,
  customPageType,
  customSectionMeta,
  isCustomPageType,
  type CustomExamPageType,
  type ExamContentPageType,
} from "../helpers/examContentTypes";
import styles from "./ExamSectionLayout.module.css";

// The pages that share this layout: the exam hub (/exams/:examSlug), its
// informational pages (/exams/:examSlug/syllabus, ..., and admin-added
// custom pages) and its product listings (/exams/:examSlug/mock-tests, ...).
type ExamSection = {
  examSlug: string;
  // Set on an informational page.
  pageType: ExamContentPageType | CustomExamPageType | null;
  // Set on a product listing page.
  productType: ExamProductType | null;
  // URL segment; null on the hub. Passed to the sidebar as the current
  // page, which matches only the informational links (as before).
  slug: string | null;
};

function parseExamSection(pathname: string): ExamSection | null {
  const [root, rawExamSlug, segment] = pathname.split("/").filter(Boolean);
  if (root !== "exams" || !rawExamSlug) return null;
  const examSlug = decodeURIComponent(rawExamSlug);
  if (!segment) return { examSlug, pageType: null, productType: null, slug: null };
  if (Object.prototype.hasOwnProperty.call(examProductPageMeta, segment)) {
    return { examSlug, pageType: null, productType: segment as ExamProductType, slug: segment };
  }
  const builtIn = EXAM_CONTENT_PAGE_TYPES.find((type) => EXAM_CONTENT_PAGE_META[type].slug === segment);
  if (builtIn) return { examSlug, pageType: builtIn, productType: null, slug: segment };
  if (CUSTOM_PAGE_SLUG_PATTERN.test(segment)) {
    return { examSlug, pageType: customPageType(segment), productType: null, slug: segment };
  }
  return null;
}

type ShellChrome = { breadcrumb: React.ReactNode; header: React.ReactNode };
type ShellLinks = { publishedPageTypes: ExamContentPageType[]; customPages: { slug: string; label: string }[] };
// What the shell knows about the exam itself, whichever section loaded it.
type ShellExam = { examSlug: string; examName: string; examLabel: string; categoryName: string };

// True when the page is rendered inside the persistent exam shell, so it
// renders only its section content (and an in-place skeleton while loading).
const ExamSectionShellContext = React.createContext(false);

export const useInExamSectionShell = () => React.useContext(ExamSectionShellContext);

// Same size and spacing as the Important Links pages' breadcrumb, so it
// doesn't change scale when switching between Overview and a section.
const HubBreadcrumb: React.FC<{ examName: string }> = ({ examName }) => (
  <nav className={styles.sectionBreadcrumb} aria-label="Breadcrumb">
    <Link to="/" className={styles.sectionBreadcrumbLink}>Home</Link>
    <ChevronRight size={14} className={styles.sectionBreadcrumbSeparator} />
    <Link to="/exams" className={styles.sectionBreadcrumbLink}>Exams</Link>
    <ChevronRight size={14} className={styles.sectionBreadcrumbSeparator} />
    <span className={styles.sectionBreadcrumbCurrent}>{examName}</span>
  </nav>
);

// The exam crumb is the short exam name ("NEET UG"), not the hub's full
// title. `label` is null while a custom page's name isn't known yet.
const SectionBreadcrumb: React.FC<{ examSlug: string; examName: string; label: string | null }> = ({
  examSlug,
  examName,
  label,
}) => (
  <nav className={styles.sectionBreadcrumb} aria-label="Breadcrumb">
    <Link to="/" className={styles.sectionBreadcrumbLink}>Home</Link>
    <ChevronRight size={14} className={styles.sectionBreadcrumbSeparator} />
    <Link to="/exams" className={styles.sectionBreadcrumbLink}>Exams</Link>
    <ChevronRight size={14} className={styles.sectionBreadcrumbSeparator} />
    <Link to={`/exams/${examSlug}`} className={styles.sectionBreadcrumbLink}>{examName}</Link>
    <ChevronRight size={14} className={styles.sectionBreadcrumbSeparator} />
    {label !== null ? (
      <span className={styles.sectionBreadcrumbCurrent}>{label}</span>
    ) : (
      <span className={styles.breadcrumbSkeleton} aria-hidden="true" />
    )}
  </nav>
);

// The product listing pages' breadcrumb: the hub's type scale with the
// smaller separators, as those pages always had. The exam crumb is the
// short exam name, as on the informational pages.
const ProductBreadcrumb: React.FC<{ examSlug: string; examName: string; label: string }> = ({
  examSlug,
  examName,
  label,
}) => (
  <nav className={styles.hubBreadcrumb} aria-label="Breadcrumb">
    <Link to="/" className={styles.hubBreadcrumbLink}>Home</Link>
    <ChevronRight size={14} className={styles.hubBreadcrumbSeparator} />
    <Link to="/exams" className={styles.hubBreadcrumbLink}>Exams</Link>
    <ChevronRight size={14} className={styles.hubBreadcrumbSeparator} />
    <Link to={`/exams/${examSlug}`} className={styles.hubBreadcrumbLink}>{examName}</Link>
    <ChevronRight size={14} className={styles.hubBreadcrumbSeparator} />
    <span className={styles.hubBreadcrumbCurrent}>{label}</span>
  </nav>
);

/**
 * Persistent layout for the exam hub, its Important Links pages and its
 * product listings (see their .pageLayout.tsx files). Floot keeps a layout
 * mounted while navigating between pages that share it, so the breadcrumb,
 * header, product tabs and Important Links sidebar live here and stay on
 * screen when an Important Links item or a product tab is clicked; only what
 * changes is redrawn.
 *
 * While the next page loads, the sidebar stays as it is (an Important Links
 * click already highlights the clicked link), the breadcrumb already names
 * the page, the header keeps its card, category badge and product tabs with
 * skeletons for the title, description and actions, and the page shows a
 * content skeleton. The queries share their keys with the pages, so nothing
 * is fetched twice. Before anything has loaded (a direct visit) the page
 * renders on its own, as it used to.
 */
export const ExamSectionLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const section = parseExamSection(pathname);
  const examSlug = section?.examSlug;
  const pageType = section?.pageType ?? null;
  const productType = section?.productType ?? null;
  const productMeta = productType ? examProductPageMeta[productType] : null;
  const isHub = !!section && pageType === null && productType === null;

  const { data: examDetail } = useExamDetailQuery(isHub || productType ? examSlug : undefined);
  const { data: countsData } = useExamProductCountsQuery(productType ? examSlug : undefined);

  const { data: overviewData } = useQuery({
    queryKey: ["exam-content", examSlug, "overview"],
    queryFn: () => getPublicExamContent({ examSlug: examSlug as string, pageType: "overview" }),
    enabled: !!examSlug && isHub,
    staleTime: 5 * 60 * 1000,
  });

  // The informational page's content, or a product page's optional
  // admin-authored title/description overlay (same keys as the pages).
  const contentPageType = pageType ?? productMeta?.contentPageType ?? null;
  const pageQuery = useQuery({
    queryKey: ["exam-content", examSlug, contentPageType],
    queryFn: () => getPublicExamContent({ examSlug: examSlug as string, pageType: contentPageType! }),
    enabled: !!examSlug && !!contentPageType,
    staleTime: 5 * 60 * 1000,
  });

  let chrome: ShellChrome | null = null;
  let links: ShellLinks | null = null;
  let exam: ShellExam | null = null;

  if ((isHub || productType) && examDetail) {
    exam = {
      examSlug: examDetail.examSlug,
      examName: examDetail.examName,
      examLabel: examDetail.fullName || examDetail.examName,
      categoryName: examDetail.categoryName,
    };
  }

  if (isHub && examDetail) {
    const examTitle = examDetail.fullName || examDetail.examName;
    const overviewContent = overviewData?.page?.content ?? null;
    const overviewFaqItems = overviewData?.page?.faqItems ?? [];
    chrome = {
      breadcrumb: <HubBreadcrumb examName={examDetail.examName} />,
      header: (
        <ExamPageHeader
          badge={examDetail.categoryName}
          title={examTitle}
          description={examDetail.description}
          actions={
            <>
              <ShareButton
                kind="exam-page"
                handle={examDetail.examSlug}
                title={examTitle}
                campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
                size="sm"
              />
              {(overviewContent?.trim() || overviewFaqItems.length > 0) && (
                <ExamContentExportButton
                  examLabel={examTitle}
                  sectionLabel="Overview"
                  title={examTitle}
                  description={examDetail.description ?? ""}
                  content={overviewContent ?? ""}
                  faqItems={overviewFaqItems}
                  label="Print"
                  variant="outline"
                  size="sm"
                />
              )}
            </>
          }
          tabs={<ExamProductTabs examSlug={examDetail.examSlug} currentSlug={null} />}
        />
      ),
    };
  }
  if (overviewData) {
    links = {
      publishedPageTypes: overviewData.publishedPageTypes,
      customPages: overviewData.publishedCustomPages ?? [],
    };
  }

  const pageData = pageQuery.data;
  if (contentPageType && pageData) {
    exam = exam ?? {
      examSlug: pageData.exam.examSlug,
      examName: pageData.exam.examName,
      examLabel: pageData.exam.fullName || pageData.exam.examName,
      categoryName: pageData.exam.categoryName,
    };
    links = {
      publishedPageTypes: pageData.publishedPageTypes,
      customPages: pageData.publishedCustomPages ?? [],
    };
  }

  if (pageType && pageData?.page && exam) {
    const page = pageData.page;
    const meta = isCustomPageType(pageType)
      ? customSectionMeta(
          pageType,
          (pageData.publishedCustomPages ?? []).find((custom) => custom.slug === customPageSlug(pageType))?.label ??
            page.title
        )
      : EXAM_CONTENT_PAGE_META[pageType];
    chrome = {
      breadcrumb: <SectionBreadcrumb examSlug={exam.examSlug} examName={exam.examName} label={meta.label} />,
      header: (
        <ExamPageHeader
          badge={exam.categoryName}
          title={page.title}
          description={page.description}
          actions={
            <>
              <ShareButton
                kind="exam-page"
                handle={`${exam.examSlug}/${meta.slug}`}
                title={page.title}
                campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
                size="sm"
              />
              <ExamContentExportButton
                examLabel={exam.examLabel}
                sectionLabel={meta.label}
                title={page.title}
                description=""
                content={page.content || ""}
                faqItems={page.faqItems || []}
                label="Print"
                variant="outline"
                size="sm"
              />
            </>
          }
          tabs={<ExamProductTabs examSlug={exam.examSlug} currentSlug={null} />}
        />
      ),
    };
  }

  // A product listing: shown once the exam and its product counts are in
  // (the page itself redirects to the hub when this type has no products).
  // The admin overlay's title/description win when published, as before.
  if (productType && productMeta && examDetail && countsData && (countsData.counts[productMeta.countKey] ?? 0) > 0) {
    const examLabel = examDetail.fullName || examDetail.examName;
    const pageContent = pageData?.page ?? null;
    const pageTitle = pageContent?.title || `${examLabel} ${productMeta.label}`;
    const pageDescription = pageContent?.description || productMeta.description(examLabel);
    chrome = {
      breadcrumb: (
        <ProductBreadcrumb examSlug={examDetail.examSlug} examName={examDetail.examName} label={productMeta.label} />
      ),
      header: (
        <ExamPageHeader
          badge={examDetail.categoryName}
          title={pageTitle}
          description={pageDescription}
          actions={
            <ShareButton
              kind="exam-page"
              handle={`${examDetail.examSlug}/${productType}`}
              title={pageTitle}
              campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
              size="sm"
            />
          }
          tabs={<ExamProductTabs examSlug={examDetail.examSlug} currentSlug={productType} />}
        />
      ),
    };
  }

  // What the shell last knew about this exam (its name, category and
  // Important Links), kept while the next page loads. Cleared when the exam
  // itself changes.
  const known = React.useRef<{ examSlug: string; exam: ShellExam | null; links: ShellLinks | null } | null>(null);
  if (!examSlug) {
    known.current = null;
  } else {
    if (known.current?.examSlug !== examSlug) {
      known.current = { examSlug, exam: null, links: null };
    }
    if (exam) known.current.exam = exam;
    if (links) known.current.links = links;
  }

  const shownLinks = links ?? known.current?.links ?? null;
  const shownExam = exam ?? known.current?.exam ?? null;

  // The page is still loading: everything the shell already knows stays,
  // the parts that change are skeletons. The breadcrumb names the page
  // straight away (an Important Links label is in the sidebar's list).
  if (!chrome && section && shownExam) {
    let breadcrumb: React.ReactNode;
    if (productMeta) {
      breadcrumb = (
        <ProductBreadcrumb examSlug={shownExam.examSlug} examName={shownExam.examName} label={productMeta.label} />
      );
    } else if (pageType === null) {
      breadcrumb = <HubBreadcrumb examName={shownExam.examName} />;
    } else {
      const label = isCustomPageType(pageType)
        ? (shownLinks?.customPages.find((custom) => custom.slug === section.slug)?.label ?? null)
        : EXAM_CONTENT_PAGE_META[pageType].label;
      breadcrumb = <SectionBreadcrumb examSlug={shownExam.examSlug} examName={shownExam.examName} label={label} />;
    }
    chrome = {
      breadcrumb,
      header: (
        <ExamPageHeader
          badge={shownExam.categoryName}
          title=""
          loading
          // The hub and the product listings always have a description under
          // their title; an informational page usually has none.
          loadingDescription={pageType === null}
          tabs={<ExamProductTabs examSlug={shownExam.examSlug} currentSlug={productType} />}
        />
      ),
    };
  }

  if (!section || !chrome) {
    return <ExamSectionShellContext.Provider value={false}>{children}</ExamSectionShellContext.Provider>;
  }

  return (
    <ExamSectionShellContext.Provider value={true}>
      <ExamPageShell
        examSlug={section.examSlug}
        currentSlug={section.slug}
        publishedPageTypes={shownLinks?.publishedPageTypes ?? []}
        customPages={shownLinks?.customPages ?? []}
        linksLoading={!shownLinks}
        breadcrumb={chrome.breadcrumb}
        header={chrome.header}
      >
        {children}
      </ExamPageShell>
    </ExamSectionShellContext.Provider>
  );
};
