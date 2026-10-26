import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { BookOpen, ClipboardCheck, FileClock, LayoutList } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { GovtExamsFilters } from "../components/GovtExamsFilters";
import { GovtExamsTable } from "../components/GovtExamsTable";
import { GovtExamsCycle } from "../components/GovtExamsCycle";
import { GovtExamsCtaBand } from "../components/GovtExamsCtaBand";
import { GovtExamsFaq } from "../components/GovtExamsFaq";
import { GovtExamsSidebar } from "../components/GovtExamsSidebar";
import {
  GEC_BANKING,
  GEC_BODIES,
  GEC_CHIPS,
  GEC_CONCLUDED,
  GEC_DISCLAIMER,
  GEC_FAQS,
  GEC_H1,
  GEC_LAST_UPDATED,
  GEC_NEXT_30,
  GEC_OPEN,
  GEC_OVERVIEW,
  GEC_PATH,
  GEC_RAILWAY,
  GEC_RELATED,
  GEC_SEO,
  GEC_SOURCES,
  GEC_SOURCES_TAIL,
  GEC_SSC,
  GEC_STATE,
  GEC_TABLES,
  GEC_UPDATE_LOG,
  GEC_UPSC,
  type GecSectionId,
} from "../helpers/govtExamsCalendarData";
import { EMPTY_FILTERS, rowMatches, todayInIndia, type GecFilters } from "../helpers/govtExamsCalendarFilter";
import styles from "./govt-exams-calendar.module.css";

const ORIGIN = "https://testkart.in";
const PAGE_URL = `${ORIGIN}${GEC_PATH}`;
/* Long enough for a smooth scroll to finish, so sections passed on the way do not take the highlight. */
const SCROLL_LOCK_MS = 1000;
const TOTAL_ROWS = GEC_TABLES.reduce((total, table) => total + table.rows.length, 0);
const RELATED_ICONS = [BookOpen, LayoutList, FileClock, ClipboardCheck];
const HERO_TAGS = ["UPSC", "SSC", "IBPS", "RRB", "State"];
/* Kept on one line in the H1 so it never breaks at the hyphen. */
const YEAR_SPAN = "2026-27";

const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Govt Exams Calendar", item: PAGE_URL },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: GEC_H1,
    url: PAGE_URL,
    description: GEC_SEO.description,
    inLanguage: "en-IN",
    datePublished: "2026-11-02",
    dateModified: GEC_LAST_UPDATED.iso,
    isPartOf: { "@type": "WebSite", name: "Testkart", url: ORIGIN },
    publisher: { "@type": "Organization", name: "Testkart", url: ORIGIN },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GEC_FAQS.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  },
];

/* November 2026 starts on a Sunday. Dots mark exam days from the next-30-days table. */
const HERO_DAYS = Array.from({ length: 30 }, (_, index) => index + 1);
const HERO_MARKS: Record<number, string> = {
  2: "peach",
  3: "mint",
  14: "lavender",
  20: "peach",
  21: "powder",
  22: "butter",
  29: "butter",
  30: "peach",
};

const scrollToSection = (id: GecSectionId) => {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
};

/** /govt-exams-calendar: the evergreen exam-dates hub. All content lives in helpers/govtExamsCalendarData. */
const GovtExamsCalendarPage: React.FC = () => {
  const [filters, setFilters] = useState<GecFilters>(EMPTY_FILTERS);
  const [today, setToday] = useState<string | null>(null);
  const [active, setActive] = useState<GecSectionId | null>(null);
  const chipsRef = useRef<HTMLElement>(null);
  const lockedUntil = useRef(0);

  const matchCount = useMemo(
    () => GEC_TABLES.reduce((total, table) => total + table.rows.filter((row) => rowMatches(table, row, filters)).length, 0),
    [filters]
  );

  // The deadline countdown depends on the reader's day, so it is worked out after hydration.
  useEffect(() => setToday(todayInIndia()), []);

  // Highlights the section under the sticky bar. root: document keeps rootMargin working in the preview iframe.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockedUntil.current) return;
        const current = entries.filter((entry) => entry.isIntersecting).at(-1);
        if (current) setActive(current.target.id as GecSectionId);
      },
      { root: document, rootMargin: "-30% 0px -65% 0px" }
    );
    document.querySelectorAll("[data-gec-section]").forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // On phones the chip bar scrolls sideways, so keep the active chip in view.
  useEffect(() => {
    const bar = chipsRef.current;
    const chip = bar?.querySelector<HTMLElement>('[aria-current="location"]');
    if (bar && chip) bar.scrollLeft = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
  }, [active]);

  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, id: GecSectionId) => {
    event.preventDefault();
    lockedUntil.current = Date.now() + SCROLL_LOCK_MS;
    setActive(id);
    scrollToSection(id);
    window.history.replaceState(window.history.state, "", `${window.location.search}#${id}`);
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const tableProps = { filters, today, onClearFilters: clearFilters };

  return (
    <>
      <SEOHead title={GEC_SEO.title} description={GEC_SEO.description} url={GEC_PATH} />
      <Helmet>
        <title>{GEC_SEO.title}</title>
        {JSON_LD.map((data) => (
          <script key={data["@type"]} type="application/ld+json">
            {JSON.stringify(data)}
          </script>
        ))}
      </Helmet>

      <div className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.hero}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link to="/">Home</Link>
                </li>
                <li aria-current="page">Govt Exams Calendar</li>
              </ol>
            </nav>

            <div className={styles.heroGrid}>
              <div className={styles.heroText}>
                <h1 className={styles.title}>
                  {GEC_H1.split(YEAR_SPAN).map((part, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <span className={styles.nowrap}>{YEAR_SPAN}</span>}
                      {part}
                    </React.Fragment>
                  ))}
                </h1>
                <div className={styles.meta}>
                  <span className={styles.updated}>
                    Last updated: <time dateTime={GEC_LAST_UPDATED.iso}>{GEC_LAST_UPDATED.label}</time>
                  </span>
                  <ul className={styles.tags} aria-label="Exam bodies covered">
                    {HERO_TAGS.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                </div>
                {GEC_OVERVIEW.map((paragraph) => (
                  <p key={paragraph} className={styles.overview}>
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className={styles.calendar} aria-hidden="true">
                <div className={styles.calendarHead}>
                  <span>Nov</span>
                  <span>2026</span>
                </div>
                <div className={styles.calendarGrid}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <span key={index} className={styles.weekday}>
                      {day}
                    </span>
                  ))}
                  {HERO_DAYS.map((day) => (
                    <span key={day} className={`${styles.day} ${HERO_MARKS[day] ? styles[HERO_MARKS[day]] : ""}`}>
                      {day}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <GovtExamsFilters filters={filters} onChange={setFilters} matchCount={matchCount} totalCount={TOTAL_ROWS} />
          </header>
        </div>

        <nav ref={chipsRef} className={styles.chips} aria-label="Jump to a category">
          <ul>
            {GEC_CHIPS.map(({ id, label }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={`${styles.chip} ${active === id ? styles.chipActive : ""}`}
                  aria-current={active === id ? "location" : undefined}
                  onClick={(event) => navigate(event, id)}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.inner}>
          <div className={styles.layout}>
            <div className={styles.main}>
              <GovtExamsTable table={GEC_NEXT_30} {...tableProps} />

              <section id="exam-bodies" data-gec-section className={styles.section} aria-labelledby="exam-bodies-title">
                <h2 id="exam-bodies-title" className={styles.sectionTitle}>
                  Government exam bodies at a glance
                </h2>
                <ul className={styles.bodies}>
                  {GEC_BODIES.map((body) => (
                    <li key={body.name} className={styles.body}>
                      <h3 className={styles.bodyName}>{body.name}</h3>
                      <dl className={styles.bodyFacts}>
                        <div>
                          <dt>Major exams</dt>
                          <dd>{body.exams}</dd>
                        </div>
                        <div>
                          <dt>Typical stages</dt>
                          <dd>{body.stages}</dd>
                        </div>
                        <div>
                          <dt>Official website</dt>
                          <dd className={styles.bodySite}>{body.website}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>

              <GovtExamsTable table={GEC_UPSC} {...tableProps} />
              <GovtExamsTable table={GEC_SSC} {...tableProps} />
              <GovtExamsTable table={GEC_BANKING} {...tableProps} />
              <GovtExamsTable table={GEC_RAILWAY} {...tableProps} />
              <GovtExamsTable table={GEC_STATE} {...tableProps} />
              <GovtExamsTable table={GEC_OPEN} {...tableProps}>
                <p className={styles.legend}>
                  <span className={styles.legendSwatch} aria-hidden="true" />
                  A red date means 3 days or fewer are left to apply.
                </p>
              </GovtExamsTable>
              <GovtExamsTable table={GEC_CONCLUDED} {...tableProps} />

              <GovtExamsCycle />
              <GovtExamsCtaBand />
              <GovtExamsFaq />

              <section id="sources" data-gec-section className={styles.section} aria-labelledby="sources-title">
                <h2 id="sources-title" className={styles.sectionTitle}>
                  Official sources and disclaimer
                </h2>
                <div className={styles.trust}>
                  <p>
                    <strong>Official sources:</strong>{" "}
                    {GEC_SOURCES.map(({ label, domain }) => `${label} (${domain})`).join(", ")}, {GEC_SOURCES_TAIL}
                  </p>
                  <p>
                    <strong>Disclaimer:</strong> {GEC_DISCLAIMER}
                  </p>
                  <div className={styles.log}>
                    <strong>Update log:</strong>
                    <ul>
                      {GEC_UPDATE_LOG.map(({ date, text }) => (
                        <li key={date}>
                          <span className={styles.logDate}>{date}.</span> {text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section className={styles.section} aria-labelledby="related-title">
                <h2 id="related-title" className={styles.sectionTitle}>
                  Related on Testkart
                </h2>
                <ul className={styles.related}>
                  {GEC_RELATED.map(({ title, text }, index) => {
                    const Icon = RELATED_ICONS[index];
                    return (
                      <li key={title} className={styles.relatedCard}>
                        <span className={styles.relatedIcon} aria-hidden="true">
                          <Icon size={20} strokeWidth={2.25} />
                        </span>
                        <h3 className={styles.relatedTitle}>{title}</h3>
                        <p className={styles.relatedText}>{text}</p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            <GovtExamsSidebar active={active} onNavigate={navigate} />
          </div>
        </div>
      </div>
    </>
  );
};

export default GovtExamsCalendarPage;
