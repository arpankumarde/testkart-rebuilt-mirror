import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  Clock,
  FlaskConical,
  Globe2,
  Landmark,
  LayoutList,
  Leaf,
  ListChecks,
  Newspaper,
  TrendingUp,
  X,
} from "lucide-react";
import { FaTelegram } from "react-icons/fa6";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { CurrentAffairsTeacherPicks } from "../components/CurrentAffairsTeacherPicks";
import { useCurrentAffairsHub, useCurrentAffairsList } from "../helpers/useCurrentAffairsPublic";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import { PUBLIC_LIST_TYPES, type PublicListType } from "../endpoints/current-affairs/list_GET.schema";
import type { PublicDigestCard } from "../endpoints/current-affairs/hub_GET.schema";
import type { CurrentAffairsContentType } from "../helpers/schema";
import styles from "./current-affairs.module.css";

const SITE_ORIGIN = "https://testkart.in";
const CANONICAL_URL = `${SITE_ORIGIN}/current-affairs`;
const PAGE_TITLE = "Current Affairs";
const PAGE_DESCRIPTION =
  "Daily, weekly and monthly current affairs digests with quizzes for UPSC, SSC, banking and other competitive exams.";
const TELEGRAM_URL = "https://t.me/testkart_in";
const GRID_LIMIT = 9;
const CARD_TAGS = 2;

const TYPE_TABS: { value: PublicListType | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "daily", label: "Daily" },
  { value: "editorials", label: "Editorials" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quiz", label: "Quiz" },
];

const TYPE_HEADINGS: Record<PublicListType, string> = {
  daily: "Daily digests",
  editorials: "Editorial analysis",
  weekly: "Weekly digests",
  monthly: "Monthly digests",
  quiz: "Digests with a quiz",
};

/* Slugs match the predefined tags seeded for Current Affairs. */
const TOPICS = [
  { slug: "polity", name: "Polity", icon: Landmark },
  { slug: "economy", name: "Economy", icon: TrendingUp },
  { slug: "environment", name: "Environment", icon: Leaf },
  { slug: "international-relations", name: "International Relations", icon: Globe2 },
  { slug: "science-technology", name: "Science & Technology", icon: FlaskConical },
];

const EXAMS = [
  { slug: "upsc-cse", name: "UPSC CSE" },
  { slug: "ssc-cgl", name: "SSC CGL" },
  { slug: "neet-ug", name: "NEET UG" },
  { slug: "ugc-net", name: "UGC NET" },
  { slug: "jee-main", name: "JEE Main" },
];

const LANGUAGES: { value: "en" | "hi" | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी" },
];

const TYPE_ICONS: Record<CurrentAffairsContentType, typeof CalendarDays> = {
  daily_digest: CalendarDays,
  weekly_digest: CalendarRange,
  monthly_digest: Calendar,
  editorial_analysis: Newspaper,
  individual_item: Newspaper,
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const digestHref = (card: PublicDigestCard) => `/current-affairs/${card.slug}`;
const quizHref = (card: PublicDigestCard) => `/current-affairs/${card.slug}#quiz`;
const toneClass = (type: CurrentAffairsContentType) => styles[`tone_${type}`] ?? "";

const periodOf = (card: PublicDigestCard) =>
  card.digestDate ? currentAffairsMeta.periodLabel(card.contentType, card.digestDate) : "";

const publishedDay = (card: PublicDigestCard) => {
  if (!card.publishedAt) return "";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(card.publishedAt)
  );
};

/** Day and month for the calendar badge: the period the digest covers, else its publish date. */
const badgeParts = (card: PublicDigestCard): { top: string; big: string } | null => {
  if (card.digestDate) {
    const [y, m, d] = card.digestDate.split("-").map(Number);
    return card.contentType === "monthly_digest" ? { top: String(y), big: MONTHS_SHORT[m - 1] } : { top: MONTHS_SHORT[m - 1], big: String(d) };
  }
  if (!card.publishedAt) return null;
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).formatToParts(
    new Date(card.publishedAt)
  );
  return { top: parts.find((p) => p.type === "month")?.value ?? "", big: parts.find((p) => p.type === "day")?.value ?? "" };
};

/**
 * The cover, or a designed stand-in on the type's pastel when there is none or it fails to load,
 * so a broken image never shows.
 */
const Cover: React.FC<{ card: PublicDigestCard; size?: "card" | "feature" }> = ({ card, size = "card" }) => {
  const [failed, setFailed] = useState(false);
  const Icon = TYPE_ICONS[card.contentType];
  if (card.coverImageUrl && !failed) {
    return (
      <img
        src={card.coverImageUrl}
        alt={card.coverImageAlt ?? ""}
        className={`${styles.cover} ${size === "feature" ? styles.coverFeature : ""}`}
        loading={size === "feature" ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className={`${styles.cover} ${styles.coverDesigned} ${size === "feature" ? styles.coverFeature : ""} ${toneClass(card.contentType)}`}
      aria-hidden="true"
    >
      <span className={styles.coverIcon}>
        <Icon size={size === "feature" ? 20 : 16} />
      </span>
      <span className={styles.coverText}>
        <span className={styles.coverPeriod}>{periodOf(card) || currentAffairsMeta.contentTypeShort(card.contentType)}</span>
        {/* The featured headline sits right beside its cover, so the cover names the type instead. */}
        <span className={styles.coverTitle}>
          {size === "feature" ? currentAffairsMeta.contentTypeLabel(card.contentType) : card.title}
        </span>
      </span>
    </span>
  );
};

/** A digest in the grid. The whole card opens the digest. */
const DigestCard: React.FC<{ card: PublicDigestCard }> = ({ card }) => {
  const tags = card.tags.filter((t) => t.kind !== "syllabus").slice(0, CARD_TAGS);
  return (
    <li className={styles.cardItem}>
      <Link to={digestHref(card)} className={styles.card}>
        <span className={styles.cardMedia}>
          <Cover card={card} />
        </span>
        <span className={styles.cardBody}>
          <span className={styles.cardEyebrow}>
            <span className={`${styles.typeDot} ${toneClass(card.contentType)}`} aria-hidden="true" />
            {currentAffairsMeta.contentTypeShort(card.contentType)}
            {publishedDay(card) && <span className={styles.cardDate}>{publishedDay(card)}</span>}
            {card.language === "hi" && <span className={styles.langTag}>हिंदी</span>}
          </span>
          <span className={styles.cardTitle}>{card.title}</span>
          {card.summary && <span className={styles.cardSummary}>{card.summary}</span>}
          {tags.length > 0 && (
            <span className={styles.cardTags}>
              {tags.map((t) => (
                <span key={`${t.kind}-${t.slug}`} className={`${styles.cardTag} ${styles[`tag_${t.kind}`] ?? ""}`}>
                  {t.name}
                </span>
              ))}
            </span>
          )}
          <span className={styles.cardFoot}>
            <span className={styles.cardMeta}>
              {card.itemCount > 0 && (
                <span>
                  <LayoutList size={13} aria-hidden="true" />
                  {card.itemCount}
                </span>
              )}
              <span>
                <Clock size={13} aria-hidden="true" />
                {card.readingTimeMinutes} min
              </span>
              {card.quizQuestionCount && (
                <span>
                  <ListChecks size={13} aria-hidden="true" />
                  Quiz
                </span>
              )}
            </span>
            <span className={styles.cardRead}>
              Read digest <ArrowRight size={14} aria-hidden="true" />
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
};

const CardGrid: React.FC<{ cards: PublicDigestCard[]; busy?: boolean }> = ({ cards, busy }) => (
  <ul className={styles.grid} aria-busy={busy}>
    {cards.map((card) => (
      <DigestCard key={card.id} card={card} />
    ))}
  </ul>
);

const GridSkeleton: React.FC = () => (
  <div className={styles.grid} aria-busy="true">
    {[0, 1, 2].map((n) => (
      <Skeleton key={n} style={{ height: "21rem", borderRadius: "var(--radius-lg)" }} />
    ))}
  </div>
);

const Featured: React.FC<{ card: PublicDigestCard }> = ({ card }) => {
  const isDaily = card.contentType === "daily_digest";
  const badge = badgeParts(card);
  return (
    <section className={`${styles.featured} ${toneClass(card.contentType)}`} aria-labelledby="ca-featured-title">
      <div className={styles.featuredText}>
        <div className={styles.featuredTop}>
          {badge && (
            <span className={styles.dateBadge} aria-hidden="true">
              <span className={styles.dateBadgeTop}>{badge.top}</span>
              <span className={styles.dateBadgeBig}>{badge.big}</span>
            </span>
          )}
          <span className={styles.featuredLabel}>
            <span>{isDaily ? "Today's digest" : `Latest ${currentAffairsMeta.contentTypeShort(card.contentType).toLowerCase()} digest`}</span>
            {periodOf(card) && <span className={styles.featuredPeriod}>{periodOf(card)}</span>}
          </span>
        </div>
        <h2 id="ca-featured-title" className={styles.featuredTitle}>
          <Link to={digestHref(card)}>{card.title}</Link>
        </h2>
        {card.summary && <p className={styles.featuredSummary}>{card.summary}</p>}
        <ul className={styles.featuredMeta}>
          {card.itemCount > 0 && (
            <li>
              <LayoutList size={14} aria-hidden="true" />
              {card.itemCount} news item{card.itemCount === 1 ? "" : "s"}
            </li>
          )}
          <li>
            <Clock size={14} aria-hidden="true" />
            {card.readingTimeMinutes} min read
          </li>
          {card.publishedAt && <li>{currentAffairsMeta.formatIst(card.publishedAt)}</li>}
        </ul>
        <div className={styles.featuredActions}>
          <Button asChild>
            <Link to={digestHref(card)}>
              Read digest <ArrowRight size={16} />
            </Link>
          </Button>
          {card.quizQuestionCount && (
            <Button asChild variant="outline">
              <Link to={quizHref(card)}>
                <ListChecks size={16} /> {isDaily ? "Take today's quiz" : "Take the quiz"}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <Link to={digestHref(card)} className={styles.featuredMedia} tabIndex={-1} aria-hidden="true">
        <Cover card={card} size="feature" />
      </Link>
    </section>
  );
};

const CurrentAffairsPage: React.FC = () => {
  const [params] = useSearchParams();
  const typeParam = params.get("type");
  const type = (PUBLIC_LIST_TYPES as readonly string[]).includes(typeParam ?? "") ? (typeParam as PublicListType) : null;
  const topic = params.get("topic") || null;
  const exam = params.get("exam") || null;
  const langParam = params.get("lang");
  const lang = langParam === "en" || langParam === "hi" ? langParam : null;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const isFiltered = !!(type || topic || exam);

  const hub = useCurrentAffairsHub({ lang: lang ?? undefined });
  const list = useCurrentAffairsList(
    { type: type ?? undefined, topic: topic ?? undefined, exam: exam ?? undefined, lang: lang ?? undefined, page },
    isFiltered
  );

  /** A link to this page with some query values changed; the page number resets unless set. */
  const withParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    const query = next.toString();
    return `/current-affairs${query ? `?${query}` : ""}`;
  };

  const data = hub.data;
  const featured = data?.latestDaily ?? data?.latest[0] ?? null;
  const latest = (data?.latest ?? []).filter((card) => card.id !== featured?.id).slice(0, GRID_LIMIT);
  const featuredExamId = featured?.tags.find((t) => t.kind === "exam" && t.examId)?.examId ?? null;

  const filterLabel = [
    type ? TYPE_HEADINGS[type] : null,
    topic ? list.data?.topicName ?? TOPICS.find((t) => t.slug === topic)?.name ?? topic : null,
    exam ? list.data?.examName ?? EXAMS.find((e) => e.slug === exam)?.name ?? exam : null,
  ]
    .filter(Boolean)
    .join(" - ");

  const telegramButton = (
    <Button asChild variant="outline" size="sm">
      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
        <FaTelegram aria-hidden="true" /> Get updates on Telegram
      </a>
    </Button>
  );

  const renderFiltered = () => {
    if (list.isFetching && !list.data) return <GridSkeleton />;
    if (list.isError) {
      return (
        <div className={styles.state} role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <p>These digests could not be loaded. Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    const rows = list.data?.rows ?? [];
    if (rows.length === 0) {
      return (
        <div className={styles.state}>
          <span className={styles.stateIcon} aria-hidden="true">
            <Newspaper size={20} />
          </span>
          <p className={styles.stateTitle}>Nothing here yet</p>
          <p>No published digests match these filters. New ones go up regularly.</p>
          <Button asChild variant="outline" size="sm">
            <Link to={withParams({ type: null, topic: null, exam: null })}>See all current affairs</Link>
          </Button>
        </div>
      );
    }
    return (
      <>
        <CardGrid cards={rows} busy={list.isFetching} />
        {list.data && list.data.totalPages > 1 && (
          <nav className={styles.pager} aria-label="Pages">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link to={withParams({ page: String(page - 1) })}>Previous</Link>
              </Button>
            ) : (
              <span />
            )}
            <span className={styles.pagerLabel}>
              Page {page} of {list.data.totalPages}
            </span>
            {page < list.data.totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link to={withParams({ page: String(page + 1) })}>Next</Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        )}
      </>
    );
  };

  const renderLatest = () => {
    if (hub.isFetching && !data) return <GridSkeleton />;
    if (hub.isError && !data) {
      return (
        <div className={styles.state} role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <p>Current affairs could not be loaded right now.</p>
          <Button variant="outline" size="sm" onClick={() => hub.refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (!featured) {
      return (
        <div className={`${styles.state} ${styles.stateLarge}`}>
          <span className={styles.stateIcon} aria-hidden="true">
            <CalendarDays size={22} />
          </span>
          <p className={styles.stateTitle}>{lang ? `No ${lang === "hi" ? "Hindi" : "English"} digests yet` : "The first digest is on its way"}</p>
          <p>Daily current affairs, weekly round-ups and quizzes will appear here as soon as they are published.</p>
          {lang ? (
            <Button asChild variant="outline" size="sm">
              <Link to={withParams({ lang: null })}>Show all languages</Link>
            </Button>
          ) : (
            telegramButton
          )}
        </div>
      );
    }
    if (latest.length === 0) {
      return (
        <div className={styles.state}>
          <span className={styles.stateIcon} aria-hidden="true">
            <CalendarDays size={20} />
          </span>
          <p className={styles.stateTitle}>You are all caught up</p>
          <p>Earlier digests will be listed here as more are published.</p>
          {telegramButton}
        </div>
      );
    }
    return <CardGrid cards={latest} />;
  };

  return (
    <>
      <SEOHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} url={CANONICAL_URL} image={featured?.coverImageUrl ?? undefined} />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
              { "@type": "ListItem", position: 2, name: PAGE_TITLE, item: CANONICAL_URL },
            ],
          })}
        </script>
      </Helmet>

      <div className={styles.page}>
        <header className={styles.intro}>
          <div className={styles.introText}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <ChevronRight size={13} aria-hidden="true" />
              <span aria-current="page">Current Affairs</span>
            </nav>
            <h1 className={styles.pageTitle}>Current Affairs</h1>
            <p className={styles.pageSubtitle}>Daily digests, weekly round-ups and quizzes for UPSC, SSC and other exams.</p>
          </div>
          <div className={styles.langSwitch} role="group" aria-label="Language">
            {LANGUAGES.map((option) => (
              <Link
                key={option.label}
                to={withParams({ lang: option.value })}
                className={`${styles.langOption} ${lang === option.value ? styles.langOptionOn : ""}`}
                aria-current={lang === option.value ? "true" : undefined}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </header>

        {!isFiltered &&
          (hub.isFetching && !data ? (
            <Skeleton style={{ height: "18rem", borderRadius: "var(--radius-lg)" }} />
          ) : featured ? (
            <Featured card={featured} />
          ) : null)}

        <nav className={styles.navBar} aria-label="Browse current affairs">
          <ul className={styles.tabs}>
            {TYPE_TABS.map((tab) => {
              const active = tab.value === null ? !type && !topic && !exam : type === tab.value;
              return (
                <li key={tab.label}>
                  <Link
                    to={tab.value ? withParams({ type: tab.value }) : withParams({ type: null, topic: null, exam: null })}
                    className={`${styles.tab} ${active ? styles.tabOn : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className={styles.examRow}>
            <span className={styles.examLabel}>Exams</span>
            <ul className={styles.examChips}>
              {EXAMS.map((e) => (
                <li key={e.slug}>
                  <Link
                    to={withParams({ exam: exam === e.slug ? null : e.slug })}
                    className={`${styles.examChip} ${exam === e.slug ? styles.examChipOn : ""}`}
                    aria-current={exam === e.slug ? "true" : undefined}
                  >
                    {e.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className={styles.layout}>
          <div className={styles.main}>
            <section className={styles.section} aria-labelledby="ca-list-title">
              <div className={styles.sectionHead}>
                <h2 id="ca-list-title" className={styles.sectionTitle}>
                  {isFiltered ? filterLabel : "Latest digests"}
                  {isFiltered && list.data && <span className={styles.count}>{list.data.total}</span>}
                </h2>
                {isFiltered ? (
                  <Link to={withParams({ type: null, topic: null, exam: null })} className={styles.sectionLink}>
                    <X size={14} aria-hidden="true" /> Clear filters
                  </Link>
                ) : (
                  <Link to={withParams({ type: "daily" })} className={styles.sectionLink}>
                    Daily archive <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </div>
              {isFiltered ? renderFiltered() : renderLatest()}
            </section>
          </div>

          <aside className={styles.sidebar} aria-label="More current affairs">
            <section className={styles.sideCard}>
              <h2 className={styles.sideTitle}>Explore topics</h2>
              <ul className={styles.topicGrid}>
                {TOPICS.map((t) => {
                  const Icon = t.icon;
                  const active = topic === t.slug;
                  return (
                    <li key={t.slug}>
                      <Link
                        to={withParams({ topic: active ? null : t.slug })}
                        className={`${styles.topicCard} ${active ? styles.topicCardOn : ""}`}
                        aria-current={active ? "true" : undefined}
                      >
                        <span className={styles.topicIcon} aria-hidden="true">
                          <Icon size={15} />
                        </span>
                        {t.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {data?.quiz && (
              <section className={`${styles.sideCard} ${styles.quizCard}`}>
                <div className={styles.quizHead}>
                  <span className={styles.quizIcon} aria-hidden="true">
                    <ListChecks size={18} />
                  </span>
                  <div>
                    <h2 className={styles.quizTitle}>
                      {data.quiz.contentType === "daily_digest" ? "Daily quiz" : `${currentAffairsMeta.contentTypeShort(data.quiz.contentType)} quiz`}
                    </h2>
                    <p className={styles.quizMeta}>
                      {data.quiz.quizQuestionCount} MCQs - no login needed
                    </p>
                  </div>
                </div>
                {periodOf(data.quiz) && <p className={styles.quizPeriod}>{periodOf(data.quiz)}</p>}
                <Button asChild size="sm" className={styles.quizButton}>
                  <Link to={quizHref(data.quiz)}>
                    Start quiz <ArrowRight size={14} />
                  </Link>
                </Button>
              </section>
            )}

            <section className={styles.sideCard}>
              <h2 className={styles.sideTitle}>From teachers on Testkart</h2>
              <CurrentAffairsTeacherPicks examId={featuredExamId} />
            </section>

            <section className={`${styles.sideCard} ${styles.updatesCard}`}>
              <h2 className={styles.sideTitle}>Get it daily</h2>
              <p className={styles.muted}>New digests and quizzes, straight to your phone.</p>
              <Button asChild variant="outline" size="sm">
                <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
                  <FaTelegram aria-hidden="true" /> Join on Telegram
                </a>
              </Button>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
};

export default CurrentAffairsPage;
