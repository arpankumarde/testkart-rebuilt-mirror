import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ClipboardCheck, FileClock, LayoutList } from "lucide-react";
import { GovtExamsFilters } from "./GovtExamsFilters";
import { GovtExamsTable } from "./GovtExamsTable";
import { GovtExamsCycle } from "./GovtExamsCycle";
import { GovtExamsCtaBand } from "./GovtExamsCtaBand";
import { GovtExamsFaq } from "./GovtExamsFaq";
import { GovtExamsSidebar } from "./GovtExamsSidebar";
import type { GecBlockKey, GecSectionId } from "../helpers/gecModel";
import { gecLongDay, type GecView } from "../helpers/gecView";
import { EMPTY_FILTERS, rowMatches, todayInIndia, type GecFilters } from "../helpers/govtExamsCalendarFilter";
import styles from "./GovtExamsCalendarView.module.css";

/* Long enough for a smooth scroll to finish, so sections passed on the way do not take the highlight. */
const SCROLL_LOCK_MS = 1000;
const RELATED_ICONS = [BookOpen, LayoutList, FileClock, ClipboardCheck];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HERO_BLOCKS: GecBlockKey[] = ["header", "hero", "chips"];

const scrollToSection = (id: GecSectionId) => {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
};

/** Keeps a year span such as 2026-27 on one line so the H1 never breaks at the hyphen. */
const Headline: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\d{4}-\d{2})/).map((part, index) =>
      /^\d{4}-\d{2}$/.test(part) ? (
        <span key={index} className={styles.nowrap}>
          {part}
        </span>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      )
    )}
  </>
);

const SmartLink: React.FC<{ href: string; className?: string; children: React.ReactNode }> = ({ href, className, children }) =>
  href.startsWith("/") ? (
    <Link to={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );

interface GovtExamsCalendarViewProps {
  view: GecView;
  /** Admin preview of one block only; the rest of the page is left out. */
  onlyBlock?: GecBlockKey | null;
}

/** The whole /govt-exams-calendar body, shared by the public page and the admin preview. */
export const GovtExamsCalendarView: React.FC<GovtExamsCalendarViewProps> = ({ view, onlyBlock = null }) => {
  const [filters, setFilters] = useState<GecFilters>(EMPTY_FILTERS);
  const [today, setToday] = useState<string | null>(null);
  const [active, setActive] = useState<GecSectionId | null>(null);
  const chipsRef = useRef<HTMLElement>(null);
  const lockedUntil = useRef(0);
  const { page, headings, tables, calendar } = view;

  const show = (block: GecBlockKey) => !onlyBlock || onlyBlock === block;
  const showHero = !onlyBlock || HERO_BLOCKS.includes(onlyBlock);
  const showMain = !onlyBlock || (!HERO_BLOCKS.includes(onlyBlock) && onlyBlock !== "footer");

  const matchCount = useMemo(
    () => view.tableList.reduce((total, table) => total + table.rows.filter((row) => rowMatches(table, row, filters)).length, 0),
    [filters, view]
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
  }, [onlyBlock]);

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
  const tableProps = { filters, today, urgentDays: view.urgentDays, onClearFilters: clearFilters };

  return (
    <div className={styles.shell}>
    <div className={styles.page}>
      {showHero && (
        <div className={styles.inner}>
          <header className={styles.hero}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link to="/">{page.breadcrumb.homeLabel}</Link>
                </li>
                <li aria-current="page">{page.breadcrumb.currentLabel}</li>
              </ol>
            </nav>

            <div className={styles.heroGrid}>
              <div className={styles.heroText}>
                <h1 className={styles.title}>
                  <Headline text={page.hero.h1} />
                </h1>
                <div className={styles.meta}>
                  <span className={styles.updated}>
                    Last updated: <time dateTime={view.lastUpdated.iso}>{view.lastUpdated.label}</time>
                  </span>
                  {page.hero.tags.length > 0 && (
                    <ul className={styles.tags} aria-label="Exam bodies covered">
                      {page.hero.tags.map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {page.hero.overview.filter(Boolean).map((paragraph) => (
                  <p key={paragraph} className={styles.overview}>
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className={styles.calendar} aria-hidden="true">
                <div className={styles.calendarHead}>
                  <span>{MONTHS[calendar.month - 1]}</span>
                  <span>{calendar.year}</span>
                </div>
                <div className={styles.calendarGrid}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <span key={index} className={styles.weekday}>
                      {day}
                    </span>
                  ))}
                  {Array.from({ length: calendar.days }, (_, index) => index + 1).map((day) => (
                    <span
                      key={day}
                      className={`${styles.day} ${calendar.marks[day] ? styles[calendar.marks[day]] : ""}`}
                      style={day === 1 && calendar.offset ? { gridColumnStart: calendar.offset + 1 } : undefined}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <GovtExamsFilters
              filters={filters}
              onChange={setFilters}
              matchCount={matchCount}
              totalCount={view.totalRows}
              monthOptions={view.monthOptions}
              placeholder={page.hero.searchPlaceholder}
            />
          </header>
        </div>
      )}

      {showHero && view.chips.length > 0 && (
        <nav ref={chipsRef} className={styles.chips} aria-label="Jump to a category">
          <ul>
            {view.chips.map(({ id, label }) => (
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
      )}

      {showMain && (
        <div className={styles.inner}>
          <div className={styles.layout}>
            <div className={styles.main}>
              {show("next-30-days") && <GovtExamsTable table={tables.next30} {...tableProps} />}

              {show("exam-bodies") && (
                <section id="exam-bodies" data-gec-section className={styles.section} aria-labelledby="exam-bodies-title">
                  <h2 id="exam-bodies-title" className={styles.sectionTitle}>
                    {headings["exam-bodies"].title}
                  </h2>
                  {headings["exam-bodies"].intro && <p className={styles.sectionIntro}>{headings["exam-bodies"].intro}</p>}
                  <ul className={styles.bodies}>
                    {page.bodies.map((body) => (
                      <li key={body.id} className={styles.body}>
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
                            <dd className={styles.bodySite}>
                              {body.url ? <SmartLink href={body.url}>{body.website || body.url}</SmartLink> : body.website}
                            </dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {show("upsc-2027") && <GovtExamsTable table={tables.upsc} {...tableProps} />}
              {show("ssc-2026-27") && <GovtExamsTable table={tables.ssc} {...tableProps} />}
              {show("banking-ibps") && <GovtExamsTable table={tables.banking} {...tableProps} />}
              {show("railway-rrb") && <GovtExamsTable table={tables.railway} {...tableProps} />}
              {show("state-exams") && <GovtExamsTable table={tables.state} {...tableProps} />}
              {show("open-applications") && (
                <GovtExamsTable table={{ ...tables.open, note: "" }} {...tableProps}>
                  {tables.open.note && (
                    <p className={styles.legend}>
                      <span className={styles.legendSwatch} aria-hidden="true" />
                      {tables.open.note}
                    </p>
                  )}
                </GovtExamsTable>
              )}
              {show("recently-concluded") && <GovtExamsTable table={tables.concluded} {...tableProps} />}

              {show("exam-cycle") && (
                <GovtExamsCycle title={headings["exam-cycle"].title} intro={headings["exam-cycle"].intro} steps={page.cycle} />
              )}
              {show("cta") && <GovtExamsCtaBand cta={page.cta} />}
              {show("faqs") && view.faqs.length > 0 && <GovtExamsFaq title={headings.faqs.title} faqs={view.faqs} />}

              {show("sources") && (
                <section id="sources" data-gec-section className={styles.section} aria-labelledby="sources-title">
                  <h2 id="sources-title" className={styles.sectionTitle}>
                    {headings.sources.title}
                  </h2>
                  <dl className={styles.trust}>
                    <div className={styles.trustRow}>
                      <dt>Official sources</dt>
                      <dd>
                        {page.sources.items.map((source, index) => (
                          <React.Fragment key={source.id}>
                            {index > 0 && ", "}
                            {source.name}
                            {source.url && (
                              <>
                                {" "}
                                (
                                <span className={styles.domain}>
                                  <SmartLink href={source.url}>{source.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</SmartLink>
                                </span>
                                )
                              </>
                            )}
                            {source.description && ` - ${source.description}`}
                          </React.Fragment>
                        ))}
                        {page.sources.tail && `${page.sources.items.length ? ", " : ""}${page.sources.tail}`}
                      </dd>
                    </div>
                    <div className={`${styles.trustRow} ${styles.trustNotice}`}>
                      <dt>Disclaimer</dt>
                      <dd>{page.sources.disclaimer}</dd>
                    </div>
                    {view.log.length > 0 && (
                      <div className={styles.trustRow}>
                        <dt>Update log</dt>
                        <dd>
                          <ul className={styles.log}>
                            {view.log.map(({ date, text }, index) => (
                              <li key={`${date}-${index}`}>
                                <span className={styles.logDate}>
                                  <time dateTime={date}>{gecLongDay(date)}</time>.
                                </span>{" "}
                                <span>{text}</span>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
              )}

              {show("related") && page.related.length > 0 && (
                <section className={styles.section} aria-labelledby="related-title">
                  <h2 id="related-title" className={styles.sectionTitle}>
                    {headings.related.title}
                  </h2>
                  <ul className={styles.related}>
                    {page.related.map((card, index) => {
                      const Icon = RELATED_ICONS[index % RELATED_ICONS.length];
                      const inner = (
                        <>
                          <span className={styles.relatedIcon} aria-hidden="true">
                            <Icon size={20} strokeWidth={2.25} />
                          </span>
                          <h3 className={styles.relatedTitle}>{card.title}</h3>
                          {card.text && <p className={styles.relatedText}>{card.text}</p>}
                        </>
                      );
                      return (
                        <li key={card.id} className={styles.relatedCard}>
                          {card.href ? (
                            <SmartLink href={card.href} className={styles.relatedInner}>
                              {inner}
                            </SmartLink>
                          ) : (
                            <div className={styles.relatedInner}>{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>

            <GovtExamsSidebar items={view.onThisPage} card={page.sidebar} active={active} onNavigate={navigate} />
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
