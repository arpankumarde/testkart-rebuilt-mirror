import React from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { SEOHead } from "../components/SEOHead";
import { Skeleton } from "../components/Skeleton";
import { Button } from "../components/Button";
import { ExamProductsSection } from "../components/ExamProductsSection";
import { ExamPageNav } from "../components/ExamPageNav";
import { ShareButton } from "../components/ShareButton";
import { ExamContentExportButton } from "../components/ExamContentExportButton";
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from "../helpers/shareLinks";

import { getPublicExamContent } from "../endpoints/exam-content/get_GET.schema";
import { type ExamContentPageType } from "../helpers/examContentTypes";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/Accordion";
import { useExamDetailQuery } from "../helpers/useExamDetail";
import { wrapContentTables } from "../helpers/contentTables";

import styles from "./exams.$examSlug.module.css";

// Main Page Component
export default function ExamDetailPage() {
  const { examSlug } = useParams<{ examSlug: string }>();

  const { data: examDetail, isFetching: isExamFetching } = useExamDetailQuery(examSlug);

  // Queries the "overview" section — this is the single source for
  // everything shown below the mixed products section (content + FAQs) AND
  // the sub-nav's `publishedPageTypes` list, so one call covers all three
  // instead of a second near-identical endpoint. This replaced the old
  // separate exams.additionalContent field — one admin editor, one query.
  const { data: contentSiloData } = useQuery({
    queryKey: ["exam-content", examSlug, "overview"],
    queryFn: () => getPublicExamContent({ examSlug: examSlug as string, pageType: "overview" }),
    enabled: !!examSlug,
    staleTime: 5 * 60 * 1000,
  });
  const publishedContentTypes: ExamContentPageType[] = contentSiloData?.publishedPageTypes ?? [];
  const overviewContent = contentSiloData?.page?.content ?? null;
  const overviewFaqItems = contentSiloData?.page?.faqItems ?? [];

  const canonicalUrl = `https://testkart.in/exams/${examSlug}`;

  // Structured Data for the exam page
  const pageStructuredData = React.useMemo(() => {
    if (!examDetail) return null;
    const graph: Record<string, unknown>[] = [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://testkart.in",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Exams",
            item: "https://testkart.in/exams",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: examDetail.examName,
            item: canonicalUrl,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        name: examDetail.fullName || examDetail.examName,
        description:
          examDetail.description ||
          `Prepare for ${examDetail.examName} with mock tests, courses, and study notes.`,
        url: canonicalUrl,
      },
    ];
    if (overviewFaqItems.length > 0) {
      graph.push({
        "@type": "FAQPage",
        mainEntity: overviewFaqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      });
    }
    return {
      "@context": "https://schema.org",
      "@graph": graph,
    };
  }, [examDetail, canonicalUrl, overviewFaqItems]);

  if (isExamFetching) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.breadcrumbSkeleton}>
          <Skeleton style={{ width: "200px", height: "20px" }} />
        </div>
        <div className={styles.heroSkeleton}>
          <Skeleton style={{ width: "300px", height: "40px", marginBottom: "var(--spacing-4)" }} />
          <Skeleton style={{ width: "600px", height: "20px" }} />
          <Skeleton style={{ width: "400px", height: "20px", marginTop: "var(--spacing-2)" }} />
        </div>
        <div className={styles.testsGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`skeleton-${i}`} className={styles.skeletonCard}>
              <div className={styles.cardHeader}>
                <Skeleton className={styles.skeletonAvatar} />
                <div className={styles.skeletonTeacherDetails}>
                  <Skeleton style={{ height: "14px", width: "100px" }} />
                  <Skeleton style={{ height: "12px", width: "150px" }} />
                </div>
              </div>
              <div className={styles.cardBody}>
                <Skeleton style={{ height: "20px", width: "100%", marginBottom: "var(--spacing-3)" }} />
                <Skeleton className={styles.skeletonThumbnail} />
                <Skeleton style={{ height: "14px", width: "120px", marginTop: "auto" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!examDetail) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.stateContainer}>
          <h2>Exam Not Found</h2>
          <p>We couldn't find the exam you're looking for.</p>
          <Button asChild variant="primary" className={styles.returnButton}>
            <Link to="/exams">Browse All Exams</Link>
          </Button>
        </div>
      </div>
    );
  }

  const pageTitle = `${examDetail.fullName || examDetail.examName} | Testkart`;
  const pageDescription =
    examDetail.description ||
    `Prepare for your ${examDetail.examName} examination with mock tests, courses, and study notes on Testkart.`;

  return (
    <>
      <SEOHead
        title={examDetail.fullName || examDetail.examName}
        description={pageDescription}
        url={canonicalUrl}
      />
      {pageStructuredData && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(pageStructuredData)}</script>
        </Helmet>
      )}

      <div className={styles.pageContainer}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/" className={styles.breadcrumbLink}>
            Home
          </Link>
          <ChevronRight size={16} className={styles.breadcrumbSeparator} />
          <Link to="/exams" className={styles.breadcrumbLink}>
            Exams
          </Link>
          <ChevronRight size={16} className={styles.breadcrumbSeparator} />
          <span className={styles.breadcrumbCurrent}>
            {examDetail.examName}
          </span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.categoryBadge}>
              {examDetail.categoryName}
            </span>
            <h1 className={styles.heroTitle}>
              {examDetail.fullName || examDetail.examName}
            </h1>
            {examDetail.description && (
              <p className={styles.heroDescription}>
                {examDetail.description}
              </p>
            )}
            <div className={styles.heroActions}>
              <ShareButton
                kind="exam-page"
                handle={examDetail.examSlug}
                title={examDetail.fullName || examDetail.examName}
                campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
              />
              {(overviewContent?.trim() || overviewFaqItems.length > 0) && (
                <ExamContentExportButton
                  examLabel={examDetail.fullName || examDetail.examName}
                  sectionLabel="Overview"
                  title={examDetail.fullName || examDetail.examName}
                  description={examDetail.description ?? ""}
                  content={overviewContent ?? ""}
                  faqItems={overviewFaqItems}
                  label="Print"
                  variant="outline"
                  size="md"
                />
              )}
            </div>
          </div>
        </header>

        <ExamPageNav
          examSlug={examDetail.examSlug}
          currentSlug={null}
          publishedPageTypes={publishedContentTypes}
          className={styles.subNav}
        />

        <main className={styles.mainContent}>
          <ExamProductsSection
            examId={examDetail.id}
            examSlug={examDetail.examSlug}
            examName={examDetail.examName}
          />
        </main>

        {overviewContent && overviewContent.trim().length > 0 && (
          <section
            className={styles.additionalContent}
            dangerouslySetInnerHTML={{ __html: wrapContentTables(overviewContent) }}
          />
        )}

        {overviewFaqItems.length > 0 && (
          <section className={styles.faqSection}>
            <h2 className={styles.faqSectionTitle}>Frequently Asked Questions</h2>
            <Accordion type="single" collapsible>
              {overviewFaqItems.map((item, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger className={styles.faqTrigger}>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}
      </div>
    </>
  );
}
