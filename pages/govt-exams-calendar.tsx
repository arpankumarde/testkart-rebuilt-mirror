import React from "react";
import { Helmet } from "react-helmet";
import { AlertCircle } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { GovtExamsCalendarView } from "../components/GovtExamsCalendarView";
import { Skeleton } from "../components/Skeleton";
import { Button } from "../components/Button";
import { GEC_PATH } from "../helpers/gecModel";
import type { GecView } from "../helpers/gecView";
import { useGecView, useGovtExamsCalendar } from "../helpers/useGovtExamsCalendar";
import styles from "./govt-exams-calendar.module.css";

const ORIGIN = "https://testkart.in";
const PAGE_URL = `${ORIGIN}${GEC_PATH}`;

const jsonLd = (view: GecView) => [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: view.page.breadcrumb.homeLabel, item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: view.page.breadcrumb.currentLabel, item: PAGE_URL },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: view.page.hero.h1,
    url: PAGE_URL,
    description: view.seo.description,
    inLanguage: "en-IN",
    datePublished: view.page.hero.datePublished,
    dateModified: view.lastUpdated.iso,
    isPartOf: { "@type": "WebSite", name: "Testkart", url: ORIGIN },
    publisher: { "@type": "Organization", name: "Testkart", url: ORIGIN },
  },
  ...(view.faqs.length
    ? [
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: view.faqs.map(({ question, answer }) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          })),
        },
      ]
    : []),
];

/** /govt-exams-calendar: the evergreen exam-dates hub, rendered from the latest published calendar (Admin, Site, Government Exams Calendar). */
const GovtExamsCalendarPage: React.FC = () => {
  const { data, isFetching, isError, refetch } = useGovtExamsCalendar();
  const view = useGecView(data);

  if (!view) {
    return (
      <div className={styles.state}>
        {isError && !isFetching ? (
          <div className={styles.error} role="alert">
            <AlertCircle size={22} aria-hidden="true" />
            <p>The exam calendar could not be loaded. Check your connection and try again.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className={styles.loading} aria-busy="true" aria-label="Loading the exam calendar">
            <Skeleton style={{ height: "18rem", borderRadius: "1.5rem" }} />
            <Skeleton style={{ height: "2.5rem", borderRadius: "var(--radius-full)" }} />
            <Skeleton style={{ height: "24rem", borderRadius: "var(--radius-lg)" }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <SEOHead title={view.seo.title} description={view.seo.description} url={GEC_PATH} />
      <Helmet>
        <title>{view.seo.title}</title>
        {jsonLd(view).map((data) => (
          <script key={data["@type"]} type="application/ld+json">
            {JSON.stringify(data)}
          </script>
        ))}
      </Helmet>
      <GovtExamsCalendarView view={view} />
    </>
  );
};

export default GovtExamsCalendarPage;