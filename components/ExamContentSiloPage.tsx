import React from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { SEOHead } from "./SEOHead";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import { getPublicExamContent } from "../endpoints/exam-content/get_GET.schema";
import {
  EXAM_CONTENT_PAGE_META,
  customPageSlug,
  customSectionMeta,
  isCustomPageType,
  type CustomExamPageType,
  type ExamContentPageType,
} from "../helpers/examContentTypes";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./Accordion";
import { useInExamSectionShell } from "./ExamSectionLayout";
import { renderMathInHtml } from "../helpers/renderMathInHtml";
import { wrapContentTables } from "../helpers/contentTables";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import "katex/dist/katex.min.css";
import styles from "./ExamContentSiloPage.module.css";

const DOMAIN = "https://testkart.in";

interface ExamContentSiloPageProps {
  // A built-in silo page, or an admin-added custom page ("custom:<slug>").
  pageType: ExamContentPageType | CustomExamPageType;
}

// Placeholder for the section content while it loads inside the persistent
// exam shell (ExamSectionLayout): the content card with a heading and text
// lines, then the FAQ card, on the same boxes and spacing as the real ones.
const SectionContentSkeleton: React.FC = () => (
  <div className={styles.sectionSkeleton} role="status" aria-busy="true" aria-live="polite">
    <span className={styles.srOnly}>Loading section</span>
    <div className={styles.skeletonContentCard} aria-hidden="true">
      <span className={`${styles.skeletonBar} ${styles.skeletonHeading}`} />
      <span className={styles.skeletonBar} style={{ width: "100%" }} />
      <span className={styles.skeletonBar} style={{ width: "96%" }} />
      <span className={styles.skeletonBar} style={{ width: "88%" }} />
      <span className={styles.skeletonBar} style={{ width: "64%" }} />
      <span className={`${styles.skeletonBar} ${styles.skeletonSubheading}`} />
      <span className={styles.skeletonBar} style={{ width: "98%" }} />
      <span className={styles.skeletonBar} style={{ width: "92%" }} />
      <span className={styles.skeletonBar} style={{ width: "76%" }} />
    </div>
    <div className={styles.skeletonFaqCard} aria-hidden="true">
      <span className={`${styles.skeletonBar} ${styles.skeletonFaqTitle}`} />
      <span className={styles.skeletonFaqRow} />
      <span className={styles.skeletonFaqRow} />
      <span className={styles.skeletonFaqRow} />
    </div>
  </div>
);

export const ExamContentSiloPage: React.FC<ExamContentSiloPageProps> = ({ pageType }) => {
  const { examSlug } = useParams<{ examSlug: string }>();
  // Inside ExamSectionLayout the breadcrumb, header, product tabs and
  // Important Links sidebar are already on screen; this renders the section.
  const inShell = useInExamSectionShell();

  const { data, isFetching } = useQuery({
    queryKey: ["exam-content", examSlug, pageType],
    queryFn: () => getPublicExamContent({ examSlug: examSlug as string, pageType }),
    enabled: !!examSlug,
    staleTime: 5 * 60 * 1000,
  });

  if (isFetching && !data) {
    if (inShell) return <SectionContentSkeleton />;
    return (
      <div className={styles.pageContainer}>
        <Skeleton style={{ width: "220px", height: "16px", marginBottom: "var(--spacing-5)" }} />
        <Skeleton style={{ width: "60%", height: "32px", marginBottom: "var(--spacing-6)" }} />
        <Skeleton style={{ width: "100%", height: "16px", marginBottom: "var(--spacing-2)" }} />
        <Skeleton style={{ width: "100%", height: "16px", marginBottom: "var(--spacing-2)" }} />
        <Skeleton style={{ width: "80%", height: "16px" }} />
      </div>
    );
  }

  // Exam genuinely doesn't exist — this is the one case where a "not found"
  // state is legitimate (there's no hub page to redirect to either).
  if (!data) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.emptyState}>
          <h2>Exam Not Found</h2>
          <p>We couldn't find the exam you're looking for.</p>
          <Button asChild variant="primary">
            <Link to="/exams">Browse All Exams</Link>
          </Button>
        </div>
      </div>
    );
  }

  const hubUrl = `/exams/${data.exam.examSlug}`;

  // The exam is real but this particular section isn't published — no 404,
  // no blank placeholder. Send visitors straight to the exam hub instead.
  if (!data.page) {
    return <Navigate to={hubUrl} replace />;
  }

  // A custom page's label comes from the exam's published custom page list.
  const meta = isCustomPageType(pageType)
    ? customSectionMeta(
        pageType,
        (data.publishedCustomPages ?? []).find((page) => page.slug === customPageSlug(pageType))?.label ??
          data.page.title
      )
    : EXAM_CONTENT_PAGE_META[pageType];
  const examLabel = data.exam.fullName || data.exam.examName;
  const canonicalUrl = `${DOMAIN}${hubUrl}/${meta.slug}`;
  const faqItems = data.page.faqItems || [];

  const structuredDataGraph: Record<string, unknown>[] = [
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
      "@type": "Article",
      headline: data.page.title,
      description: data.page.seoDescription || undefined,
      url: canonicalUrl,
    },
  ];

  if (faqItems.length > 0) {
    structuredDataGraph.push({
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }

  const pageStructuredData = {
    "@context": "https://schema.org",
    "@graph": structuredDataGraph,
  };

  // The breadcrumb, header (title, Share/Print), product tabs and sidebar are
  // rendered around this by ExamSectionLayout.
  return (
    <>
      <SEOHead
        title={data.page.seoTitle || data.page.title}
        description={data.page.seoDescription || `${meta.titleSuffix} for ${examLabel} on Testkart.`}
        url={canonicalUrl}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(pageStructuredData)}</script>
      </Helmet>

      <div className={styles.content} dangerouslySetInnerHTML={{ __html: wrapContentTables(renderMathInHtml(sanitizeHtml(data.page.content))) }} />

      {faqItems.length > 0 && (
        <div className={styles.faqSection}>
          <h2 className={styles.faqSectionTitle}>Frequently Asked Questions</h2>
          <Accordion type="single" collapsible>
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className={styles.faqTrigger}>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* The short exam name ("NEET UG"): the full title often reads like a
          page heading ("NEET UG 2027 Mock Tests, Courses & ...") and makes
          this sentence and button run long. */}
      <div className={styles.ctaBox}>
        <p>Ready to practice? Explore {data.exam.examName} mock tests from top educators.</p>
        <Button asChild className={styles.ctaButton}>
          <Link to={hubUrl}>Browse {data.exam.examName} Mock Tests</Link>
        </Button>
      </div>
    </>
  );
};
