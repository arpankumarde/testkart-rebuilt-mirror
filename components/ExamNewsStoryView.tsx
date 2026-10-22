import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CalendarClock, CalendarDays, ExternalLink, FilePenLine, Landmark, Newspaper, RefreshCw, UserRound } from "lucide-react";
import { examNewsPublicMeta } from "../helpers/examNewsPublicMeta";
import { useExamNewsDetails, useExamNewsSidebar } from "../helpers/useExamNewsPublic";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import type { PublicExamNewsStory } from "../endpoints/exam-news/details_GET.schema";
import { SEOHead } from "./SEOHead";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ExamNewsListItem, ExamNewsTypeBadge } from "./ExamNewsListItem";
import { ExamNewsSidebar } from "./ExamNewsSidebar";
import styles from "./ExamNewsStoryView.module.css";

const SITE_ORIGIN = "https://testkart.in";

const DATE_COLUMNS = [
  { key: "startDate", label: "Starts" },
  { key: "endDate", label: "Ends" },
  { key: "examDate", label: "Exam" },
  { key: "resultDate", label: "Result" },
] as const;

const hasText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().length > 0;

/** The admin's canonical URL, when it points at testkart.in; anything else falls back to the story itself. */
const canonicalFor = (story: PublicExamNewsStory, canonicalPath: string): string => {
  if (!story.canonicalUrl) return canonicalPath;
  try {
    const url = new URL(story.canonicalUrl);
    return url.hostname === "testkart.in" ? url.pathname.replace(/\/+$/, "") || canonicalPath : canonicalPath;
  } catch {
    return canonicalPath;
  }
};

const articleJsonLd = (story: PublicExamNewsStory, canonicalPath: string) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: story.title,
    description: story.summary ?? undefined,
    image: story.heroImageUrl ? [story.heroImageUrl] : undefined,
    datePublished: story.publishedAt ? new Date(story.publishedAt).toISOString() : undefined,
    dateModified: new Date(story.updatedAt).toISOString(),
    author: story.authorName ? { "@type": "Person", name: story.authorName } : { "@type": "Organization", name: "Testkart" },
    publisher: { "@type": "Organization", name: "Testkart", url: SITE_ORIGIN },
    mainEntityOfPage: `${SITE_ORIGIN}${canonicalPath}`,
  }).replace(/</g, "\\u003c");

export const ExamNewsStoryView: React.FC<{ slug: string }> = ({ slug }) => {
  const { data, isLoading, isError, error, refetch } = useExamNewsDetails(slug);
  const sidebar = useExamNewsSidebar();
  const notFound = isError && /not found/i.test(String(error));
  const location = useLocation();
  const navigate = useNavigate();

  // In-app visits to a renamed story's old URL land on the current one (SSR answers those with a 301).
  useEffect(() => {
    if (data && data.canonicalPath !== location.pathname) navigate(data.canonicalPath, { replace: true });
  }, [data, location.pathname, navigate]);

  if (isLoading && !data) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: "1rem", width: "14rem", marginBottom: "1.5rem" }} />
        <Skeleton style={{ height: "2.5rem", width: "80%", marginBottom: "1rem" }} />
        <Skeleton style={{ height: "1.25rem", width: "60%", marginBottom: "2rem" }} />
        <Skeleton style={{ height: "22rem", borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <SEOHead
          title={notFound ? "Story not found" : "Exam News"}
          description="This exam news story is not available."
          url={examNewsPublicMeta.storyPath(slug)}
          noIndex
        />
        <div className={styles.state} role={notFound ? undefined : "alert"}>
          <span className={`${styles.stateIcon} ${notFound ? "" : styles.stateIconError}`} aria-hidden="true">
            {notFound ? <Newspaper size={22} /> : <AlertCircle size={22} />}
          </span>
          <h1 className={styles.stateTitle}>{notFound ? "We could not find that story" : "We could not load this story"}</h1>
          <p className={styles.stateText}>
            {notFound ? "It may have been removed, or the link may be wrong." : "Check your connection and try again."}
          </p>
          <div className={styles.stateActions}>
            {!notFound && (
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            )}
            <Button asChild variant={notFound ? "outline" : "ghost"}>
              <Link to={examNewsPublicMeta.HUB_PATH}>Back to Exam News</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { story, related, relatedIsSameExam, canonicalPath } = data;
  const updated = examNewsPublicMeta.wasUpdated(story.publishedAt, story.updatedAt);
  const keyDates = story.keyDates.filter((row) => row.eventName || DATE_COLUMNS.some((c) => row[c.key]));
  const shareTitle = story.ogTitle || story.seoTitle || story.title;
  const shareDescription = story.ogDescription || story.seoDescription || story.summary || "";

  return (
    <div className={styles.page}>
      <SEOHead
        title={story.seoTitle || story.title}
        description={story.seoDescription || story.summary || `${examNewsPublicMeta.typeLabel(story.newsType)} update${story.exam ? ` for ${story.exam.name}` : ""}.`}
        image={story.ogImageUrl || story.heroImageUrl || undefined}
        url={canonicalFor(story, canonicalPath)}
        type="article"
      />
      <Helmet>
        {(story.ogTitle || story.ogDescription) && <meta property="og:title" content={shareTitle} />}
        {shareDescription && story.ogDescription && <meta property="og:description" content={shareDescription} />}
        {story.publishedAt && <meta property="article:published_time" content={new Date(story.publishedAt).toISOString()} />}
        <meta property="article:modified_time" content={new Date(story.updatedAt).toISOString()} />
        <script type="application/ld+json">{articleJsonLd(story, canonicalPath)}</script>
      </Helmet>

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to={examNewsPublicMeta.HUB_PATH}>Exam News</Link>
          </li>
          {story.exam && (
            <li>
              <Link to={examNewsPublicMeta.listingPath({ examSlug: story.exam.slug })}>{story.exam.name}</Link>
            </li>
          )}
        </ol>
      </nav>

      <div className={styles.layout}>
        <article className={styles.article}>
          <header className={styles.header}>
            <div className={styles.tags}>
              <ExamNewsTypeBadge type={story.newsType} asLink className={styles.typeBadge} />
              {story.exam && (
                <Link to={examNewsPublicMeta.listingPath({ examSlug: story.exam.slug })} className={styles.examTag}>
                  {story.exam.name}
                </Link>
              )}
            </div>
            <h1 className={styles.headline}>{story.title}</h1>
            {story.summary && <p className={styles.standfirst}>{story.summary}</p>}
            <ul className={styles.meta}>
              {story.authorName && (
                <li>
                  <UserRound size={14} aria-hidden="true" /> By {story.authorName}
                </li>
              )}
              {story.publishedAt && (
                <li>
                  <CalendarDays size={14} aria-hidden="true" /> Published{" "}
                  <time dateTime={new Date(story.publishedAt).toISOString()}>{examNewsPublicMeta.formatDateTime(story.publishedAt)}</time>
                </li>
              )}
              {updated && (
                <li>
                  <RefreshCw size={14} aria-hidden="true" /> Updated{" "}
                  <time dateTime={new Date(story.updatedAt).toISOString()}>{examNewsPublicMeta.formatDateTime(story.updatedAt)}</time>
                </li>
              )}
            </ul>
          </header>

          {story.heroImageUrl && (
            <figure className={styles.hero}>
              <img src={story.heroImageUrl} alt={story.heroImageAlt ?? ""} className={styles.heroImage} />
              {story.heroImageCredit && <figcaption className={styles.credit}>{story.heroImageCredit}</figcaption>}
            </figure>
          )}

          {keyDates.length > 0 && (
            <section className={styles.keyDates} aria-labelledby="en-key-dates">
              <h2 id="en-key-dates" className={styles.sectionTitle}>
                <CalendarClock size={18} aria-hidden="true" /> Important dates
              </h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Event</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyDates.map((row, index) => (
                      <tr key={`${row.eventName}-${index}`}>
                        <th scope="row">
                          {row.eventName}
                          {row.note && <span className={styles.rowNote}>{row.note}</span>}
                        </th>
                        <td>
                          <ul className={styles.dateList}>
                            {DATE_COLUMNS.filter((c) => row[c.key]).map((c) => (
                              <li key={c.key}>
                                <span className={styles.dateLabel}>{c.label}</span>
                                <span>{row[c.key]}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {hasText(story.body) && <div className={styles.prose} dangerouslySetInnerHTML={{ __html: sanitizeHtml(story.body) }} />}

          {(story.officialSource || story.sources.length > 0) && (
            <section className={styles.sourceBox} aria-labelledby="en-official-source">
              <h2 id="en-official-source" className={styles.boxTitle}>
                <Landmark size={16} aria-hidden="true" /> Official source
              </h2>
              {story.officialSource && (
                <a href={story.officialSource.url} target="_blank" rel="noopener noreferrer" className={styles.officialLink}>
                  {story.officialSource.name}
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              )}
              {story.sources.length > 0 && (
                <ul className={styles.sourceList}>
                  {story.sources.map((source, index) => (
                    <li key={`${source.url}-${index}`}>
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.name || source.url}
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.sourceNote}>Always confirm dates and instructions on the official website before you act.</p>
            </section>
          )}

          {story.corrections.length > 0 && (
            <section className={styles.correctionBox} aria-labelledby="en-corrections">
              <h2 id="en-corrections" className={styles.boxTitle}>
                <FilePenLine size={16} aria-hidden="true" /> Corrections
              </h2>
              <ul className={styles.correctionList}>
                {story.corrections.map((c, index) => (
                  <li key={`${c.date}-${index}`}>
                    <time dateTime={c.date} className={styles.correctionDate}>
                      {examNewsPublicMeta.formatDay(c.date)}
                    </time>
                    {c.note}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className={styles.articleFooter}>
            <Link to={examNewsPublicMeta.HUB_PATH} className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" /> Back to Exam News
            </Link>
            {story.exam && (
              <Link to={examNewsPublicMeta.listingPath({ examSlug: story.exam.slug })} className={styles.moreLink}>
                More {story.exam.name} news
              </Link>
            )}
          </footer>
        </article>

        <ExamNewsSidebar data={sidebar.data} isLoading={sidebar.isLoading} showRecent={false}>
          {related.length > 0 && (
            <section className={styles.relatedCard} aria-labelledby="en-related">
              <h2 id="en-related" className={styles.relatedTitle}>
                {relatedIsSameExam && story.exam ? `More ${story.exam.name} updates` : "Latest exam news"}
              </h2>
              <div>
                {related.map((item) => (
                  <ExamNewsListItem key={item.id} item={item} compact headingLevel="h3" />
                ))}
              </div>
            </section>
          )}
        </ExamNewsSidebar>
      </div>
    </div>
  );
};