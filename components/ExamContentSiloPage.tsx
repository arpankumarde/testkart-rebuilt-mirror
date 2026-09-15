import React from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { SEOHead } from "./SEOHead";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import { getPublicExamContent } from "../endpoints/exam-content/get_GET.schema";
import { EXAM_CONTENT_PAGE_META, type ExamContentPageType } from "../helpers/examContentTypes";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./Accordion";
import { ExamPageNav } from "./ExamPageNav";
import { ShareButton } from "./ShareButton";
import { ExamContentExportButton } from "./ExamContentExportButton";
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from "../helpers/shareLinks";
import { renderMathInHtml } from "../helpers/renderMathInHtml";
import { wrapContentTables } from "../helpers/contentTables";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import "katex/dist/katex.min.css";
import styles from "./ExamContentSiloPage.module.css";

const DOMAIN = "https://testkart.in";

interface ExamContentSiloPageProps {
  pageType: ExamContentPageType;
}

export const ExamContentSiloPage: React.FC<ExamContentSiloPageProps> = ({ pageType }) => {
  const { examSlug } = useParams<{ examSlug: string }>();
  const meta = EXAM_CONTENT_PAGE_META[pageType];

  const { data, isFetching } = useQuery({
    queryKey: ["exam-content", examSlug, pageType],
    queryFn: () => getPublicExamContent({ examSlug: examSlug as string, pageType }),
    enabled: !!examSlug,
    staleTime: 5 * 60 * 1000,
  });

  if (isFetching && !data) {
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

  return (
    <div className={styles.pageContainer}>
      <SEOHead
        title={data.page.seoTitle || data.page.title}
        description={data.page.seoDescription || `${meta.titleSuffix} for ${examLabel} on Testkart.`}
        url={canonicalUrl}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(pageStructuredData)}</script>
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

      <div className={styles.titleRow}>
        <h1 className={styles.pageTitle}>{data.page.title}</h1>
        <div className={styles.pageActions}>
          <ShareButton
            kind="exam-page"
            handle={`${data.exam.examSlug}/${meta.slug}`}
            title={data.page.title}
            campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
          />
          <ExamContentExportButton
            examLabel={examLabel}
            sectionLabel={meta.label}
            title={data.page.title}
            description=""
            content={data.page.content || ""}
            faqItems={faqItems}
            label="Print"
            variant="outline"
            size="md"
          />
        </div>
      </div>

      <ExamPageNav
        examSlug={data.exam.examSlug}
        currentSlug={meta.slug}
        publishedPageTypes={data.publishedPageTypes}
        className={styles.subNav}
      />

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

      <div className={styles.ctaBox}>
        <p>Ready to practice? Explore {examLabel} mock tests from top educators.</p>
        <Button asChild>
          <Link to={hubUrl}>Browse {examLabel} Mock Tests</Link>
        </Button>
      </div>
    </div>
  );
};
