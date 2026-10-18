import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, Calendar, CalendarDays, CalendarRange, Check, ChevronLeft, ChevronRight, Newspaper, X } from "lucide-react";
import { FaTelegram } from "react-icons/fa6";
import { SEOHead } from "./SEOHead";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { CurrentAffairsTeacherPicks } from "./CurrentAffairsTeacherPicks";
import { useCurrentAffairsHub, useCurrentAffairsList, useCurrentAffairsStories } from "../helpers/useCurrentAffairsPublic";
import { currentAffairsMeta, type ArchiveType } from "../helpers/currentAffairsMeta";
import type { PublicDigestCard } from "../endpoints/current-affairs/hub_GET.schema";
import type { PublicDailyStory } from "../endpoints/current-affairs/stories_GET.schema";
import type { CurrentAffairsContentType } from "../helpers/schema";
import styles from "./CurrentAffairsHub.module.css";

const SITE_ORIGIN = "https://testkart.in";
const ROW_TAGS = 3;
const SIDEBAR_MONTHS = 3;
const TELEGRAM_URL = "https://t.me/testkart_in";

/* Topic slugs shown first in the filter, in this order; any other topic tags follow under "View all". */
const LEAD_TOPICS = [
  "polity",
  "economy",
  "science-technology",
  "international-relations",
  "environment",
  "history",
  "geography",
  "defence",
  "sports",
  "awards-honours",
  "government-schemes",
  "important-appointments",
];
const TOPIC_TONES = ["topicCoral", "topicTeal", "topicLavender", "topicMint", "topicBlue"] as const;

const TABS: { value: ArchiveType; label: string; noun: [string, string]; icon: typeof CalendarDays }[] = [
  { value: "daily", label: "Daily", noun: ["daily story", "daily stories"], icon: CalendarDays },
  { value: "weekly", label: "Weekly", noun: ["weekly roundup", "weekly roundups"], icon: CalendarRange },
  { value: "monthly", label: "Monthly", noun: ["monthly digest", "monthly digests"], icon: Calendar },
];

const TYPE_ICONS: Record<CurrentAffairsContentType, typeof CalendarDays> = {
  daily_digest: Newspaper,
  weekly_digest: CalendarRange,
  monthly_digest: Calendar,
  editorial_analysis: Newspaper,
  individual_item: Newspaper,
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const digestHref = (card: PublicDigestCard) => currentAffairsMeta.canonicalPath(card);
const toneClass = (type: CurrentAffairsContentType) => styles[`tone_${type}`] ?? "";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const typeLabel = (type: CurrentAffairsContentType) =>
  type === "weekly_digest" ? "Weekly" : type === "monthly_digest" ? "Monthly" : "Daily";

/** The digest's own image as the API resolves it (cover, share image, first item image). */
const imageOf = (card: PublicDigestCard) => card.thumbnailUrl ?? card.coverImageUrl ?? null;

/** The day the digest covers, else its publish day in IST, as YYYY-MM-DD. */
const coverDay = (card: PublicDigestCard): string | null => {
  if (card.digestDate) return card.digestDate;
  if (!card.publishedAt) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(card.publishedAt));
};

type Period = { y: number; m: number; d: number; endY: number; endM: number; endD: number; weekday: number };

const periodParts = (card: PublicDigestCard): Period | null => {
  const day = coverDay(card);
  if (!day) return null;
  const [y, m, d] = day.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 6));
  return { y, m, d, endY: end.getUTCFullYear(), endM: end.getUTCMonth() + 1, endD: end.getUTCDate(), weekday: start.getUTCDay() };
};

/** "Fri, 23 Oct 2026", "19-25 Oct 2026", "August 2023". */
const periodText = (card: PublicDigestCard): string => {
  const p = periodParts(card);
  if (!p) return "";
  if (card.contentType === "monthly_digest") return `${MONTHS_LONG[p.m - 1]} ${p.y}`;
  if (card.contentType === "weekly_digest") {
    if (p.endM === p.m) return `${p.d}-${p.endD} ${MONTHS_SHORT[p.m - 1]} ${p.endY}`;
    return `${p.d} ${MONTHS_SHORT[p.m - 1]} - ${p.endD} ${MONTHS_SHORT[p.endM - 1]} ${p.endY}`;
  }
  return `${WEEKDAYS[p.weekday]}, ${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
};

/** The large and small lines a fallback thumbnail prints. */
const fallbackLines = (card: PublicDigestCard, feature: boolean): { big: string; small: string } => {
  const p = periodParts(card);
  if (!p) return { big: "Digest", small: "" };
  if (card.contentType === "monthly_digest") return { big: feature ? MONTHS_LONG[p.m - 1] : MONTHS_SHORT[p.m - 1], small: String(p.y) };
  if (card.contentType === "weekly_digest") {
    const months = p.endM === p.m ? MONTHS_SHORT[p.m - 1] : `${MONTHS_SHORT[p.m - 1]} - ${MONTHS_SHORT[p.endM - 1]}`;
    return { big: `${p.d}-${p.endD}`, small: `${months} ${p.endY}` };
  }
  return { big: String(p.d), small: `${MONTHS_SHORT[p.m - 1]} ${p.y}` };
};

const rowTags = (card: PublicDigestCard) =>
  [...card.tags.filter((t) => t.kind === "topic"), ...card.tags.filter((t) => t.kind === "exam")].slice(0, ROW_TAGS);

/** Tracks whether the digest's image is usable, so callers can fall back once it fails to load. */
const useImage = (card: PublicDigestCard) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = imageOf(card);
  const usable = !!src && src !== failedSrc;
  return { src: usable ? src : null, onError: () => setFailedSrc(src) };
};

/** Page numbers to show: the first, the last and two either side of the current one, with gaps. */
const pageWindow = (page: number, totalPages: number): (number | "gap")[] => {
  const pages: (number | "gap")[] = [];
  for (let n = 1; n <= totalPages; n++) {
    if (n === 1 || n === totalPages || Math.abs(n - page) <= 2) pages.push(n);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }
  return pages;
};

/**
 * The digest's own image (cover, share image or first item image, resolved by the API), or a
 * designed stand-in printed with the digest's period when it has none or the image fails.
 */
const Thumb: React.FC<{ card: PublicDigestCard; feature?: boolean }> = ({ card, feature = false }) => {
  const image = useImage(card);
  if (image.src) {
    return <img src={image.src} alt="" className={styles.thumbImage} loading="lazy" onError={image.onError} />;
  }
  const Icon = TYPE_ICONS[card.contentType];
  const lines = fallbackLines(card, feature);
  return (
    <span className={`${styles.thumbFallback} ${toneClass(card.contentType)}`} aria-hidden="true">
      <span className={styles.thumbIcon}>
        <Icon size={14} />
      </span>
      <span className={styles.thumbRules}>
        <span />
        <span />
        <span />
      </span>
      <span className={styles.thumbDate}>
        <span className={styles.thumbBig}>{lines.big}</span>
        {lines.small && <span className={styles.thumbSmall}>{lines.small}</span>}
      </span>
    </span>
  );
};

const DigestRow: React.FC<{ card: PublicDigestCard }> = ({ card }) => {
  const tags = rowTags(card);
  const badge = periodText(card);
  return (
    <li>
      <Link to={digestHref(card)} className={styles.row}>
        <span className={styles.thumb}>
          <Thumb card={card} />
        </span>
        <span className={styles.rowBody}>
          <span className={styles.rowTop}>
            {badge && (
              <time className={`${styles.dateBadge} ${toneClass(card.contentType)}`} dateTime={coverDay(card) ?? undefined}>
                {badge}
              </time>
            )}
            <span className={styles.rowType}>{typeLabel(card.contentType)}</span>
            {card.itemCount > 0 && <span className={styles.rowStat}>{plural(card.itemCount, "story", "stories")}</span>}
            {card.language === "hi" && <span className={styles.rowStat}>हिंदी</span>}
          </span>
          <span className={styles.rowTitle}>{card.title}</span>
          {card.summary && <span className={styles.rowSummary}>{card.summary}</span>}
          <span className={styles.rowMeta}>
            {tags.map((t) => (
              <span key={`${t.kind}-${t.slug}`} className={`${styles.tag} ${t.kind === "exam" ? styles.tagExam : ""}`}>
                {t.name}
              </span>
            ))}
            <span className={styles.rowStat}>{card.readingTimeMinutes} min read</span>
          </span>
        </span>
        <span className={styles.rowAction}>
          Read digest <ArrowRight size={15} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
};

const ListSkeleton: React.FC = () => (
  <ul className={styles.list} aria-busy="true" aria-label="Loading digests">
    {[0, 1, 2].map((n) => (
      <li key={n} className={styles.skeletonRow}>
        <Skeleton className={styles.skeletonThumb} />
        <span className={styles.skeletonLines}>
          <Skeleton style={{ width: "8rem", height: "1.25rem", borderRadius: "999px" }} />
          <Skeleton style={{ width: "75%", height: "1.15rem" }} />
          <Skeleton style={{ width: "95%", height: "0.85rem" }} />
          <Skeleton style={{ width: "45%", height: "0.85rem" }} />
        </span>
      </li>
    ))}
  </ul>
);

/** "Tue, 19 Sep 2023" for the day a story's digest covers. */
const storyDay = (story: PublicDailyStory): string => {
  if (!story.digestDate) return "";
  const [y, m, d] = story.digestDate.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS_SHORT[m - 1]} ${y}`;
};

/** A story's image, else a small tile with its day; the story's section opens from the whole row. */
const StoryRow: React.FC<{ story: PublicDailyStory }> = ({ story }) => {
  const [failed, setFailed] = useState(false);
  const day = storyDay(story);
  const [y, m, d] = (story.digestDate ?? "").split("-").map(Number);
  return (
    <li>
      <Link to={story.href} className={styles.story}>
        <span className={styles.storyThumb}>
          {story.thumbnailUrl && !failed ? (
            <img src={story.thumbnailUrl} alt="" className={styles.thumbImage} loading="lazy" onError={() => setFailed(true)} />
          ) : (
            <span className={`${styles.storyDate} ${styles.tone_daily_digest}`} aria-hidden="true">
              <span className={styles.storyDateBig}>{d || ""}</span>
              <span className={styles.storyDateSmall}>{m ? `${MONTHS_SHORT[m - 1]} ${y}` : ""}</span>
            </span>
          )}
        </span>
        <span className={styles.storyBody}>
          {day && (
            <time className={styles.storyMeta} dateTime={story.digestDate ?? undefined}>
              {day}
              {story.language === "hi" && " - हिंदी"}
            </time>
          )}
          <span className={styles.storyTitle}>{story.headline}</span>
          {story.summary && <span className={styles.storySummary}>{story.summary}</span>}
          {story.tags.length > 0 && (
            <span className={styles.storyTags}>
              {story.tags.slice(0, ROW_TAGS).map((t) => (
                <span key={t.slug} className={styles.tag}>
                  {t.name}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className={styles.storyAction}>
          Read more <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
};

const StorySkeleton: React.FC = () => (
  <ul className={styles.stories} aria-busy="true" aria-label="Loading stories">
    {[0, 1, 2, 3].map((n) => (
      <li key={n} className={styles.storySkeleton}>
        <Skeleton className={styles.skeletonThumb} />
        <span className={styles.skeletonLines}>
          <Skeleton style={{ width: "6rem", height: "0.75rem" }} />
          <Skeleton style={{ width: "70%", height: "1rem" }} />
          <Skeleton style={{ width: "92%", height: "0.8rem" }} />
        </span>
      </li>
    ))}
  </ul>
);

/** A monthly digest in the sidebar: its cover on top, or the dated editorial stand-in when it has none. */
const MonthCard: React.FC<{ card: PublicDigestCard }> = ({ card }) => {
  return (
    <li>
      <Link to={digestHref(card)} className={styles.monthCard}>
        <span className={styles.monthMedia}>
          <Thumb card={card} feature />
        </span>
        <span className={styles.monthBody}>
          <span className={styles.monthPeriod}>{periodText(card)}</span>
          <span className={styles.monthTitle}>{card.title}</span>
          {card.summary && <span className={styles.monthSummary}>{card.summary}</span>}
          <span className={styles.monthFoot}>
            {card.itemCount > 0 && <span className={styles.rowStat}>{plural(card.itemCount, "story", "stories")}</span>}
            <span className={styles.monthAction}>
              Read digest <ArrowRight size={14} aria-hidden="true" />
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
};

const WeeklyCard: React.FC<{ card: PublicDigestCard }> = ({ card }) => (
  <section className={styles.sideSection} aria-labelledby="ca-weekly-title">
    <h2 id="ca-weekly-title" className={styles.sideHeading}>
      Latest weekly roundup
    </h2>
    <Link to={digestHref(card)} className={styles.weekCard}>
      <span className={styles.monthPeriod}>{periodText(card)}</span>
      <span className={styles.monthTitle}>{card.title}</span>
      <span className={styles.monthAction}>
        Read digest <ArrowRight size={14} aria-hidden="true" />
      </span>
    </Link>
  </section>
);

/**
 * The Current Affairs landing page and its archives. Without `archive` it is the hub at
 * /current-affairs (the newest daily stories); with one it is /current-affairs/{archive}, paged
 * with ?page= links that crawlers can follow. The daily views list each story of the published
 * daily digests on its own; weekly and monthly list whole digests.
 */
export const CurrentAffairsHub: React.FC<{ archive?: ArchiveType; className?: string }> = ({ archive, className }) => {
  const [params] = useSearchParams();
  const type: ArchiveType = archive ?? "daily";
  const page = archive ? Math.max(1, Math.floor(Number(params.get("page"))) || 1) : 1;
  const langParam = params.get("lang");
  const lang = langParam === "en" || langParam === "hi" ? langParam : undefined;
  const tab = TABS.find((t) => t.value === type)!;
  const legacyType = archive ? null : params.get("type");
  const topic = type === "daily" ? params.get("topic") || undefined : undefined;
  const [showAllTopics, setShowAllTopics] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const shownPage = useRef(page);

  const hub = useCurrentAffairsHub({ lang });
  const isDaily = type === "daily";
  const list = useCurrentAffairsList({ type, lang, page }, !isDaily);
  const stories = useCurrentAffairsStories({ lang, page, topic }, isDaily);
  const months = useCurrentAffairsList({ type: "monthly", lang, page: 1 }, true);

  // A page from the previous tab is not a preview of this one; show the skeleton instead.
  const contentType = currentAffairsMeta.ARCHIVE_CONTENT_TYPE[type];
  const stale = list.isPlaceholderData && (list.data?.rows ?? []).some((row) => row.contentType !== contentType);
  const rows = stale ? [] : list.data?.rows ?? [];
  const storyRows = stories.data?.rows ?? [];
  const active = isDaily ? stories : list;
  const shownCount = isDaily ? storyRows.length : rows.length;
  const total = active.data?.total ?? 0;
  const totalPages = active.data?.totalPages ?? 1;
  const monthCards = (months.data?.rows ?? []).slice(0, SIDEBAR_MONTHS);
  const monthTotal = months.data?.total ?? 0;
  const weekly = hub.data?.weekly ?? null;
  const pickExamId = hub.data?.latestDaily?.tags.find((t) => t.kind === "exam" && t.examId)?.examId ?? null;

  // Moving to another page of the archive brings the list back into view; switching tabs does not move the page.
  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    const top = mainRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) mainRef.current?.scrollIntoView({ block: "start" });
  }, [page]);

  const lastPublished = (hub.data?.latest ?? [])
    .map((c) => (c.publishedAt ? new Date(c.publishedAt).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  const updatedLabel = lastPublished
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(
        new Date(lastPublished)
      )
    : null;

  /** A path with the reader's language, and any extra values, as query parameters. */
  const withParams = (path: string, extra: Record<string, string | undefined> = {}) => {
    const [base, query = ""] = path.split("?");
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries({ ...extra, lang })) {
      if (value) next.set(key, value);
    }
    const search = next.toString();
    return `${base}${search ? `?${search}` : ""}`;
  };
  const withLang = (path: string) => withParams(path);
  const tabLinkProps = { preventScrollReset: true, state: { preserveScroll: true } };

  // Topics filter the daily stories; from weekly or monthly they lead to the daily archive.
  const allTopics = hub.data?.topics ?? [];
  const leadTopics = LEAD_TOPICS.map((slug) => allTopics.find((t) => t.slug === slug)).filter((t): t is { name: string; slug: string } => !!t);
  const orderedTopics = [...leadTopics, ...allTopics.filter((t) => !LEAD_TOPICS.includes(t.slug))];
  const visibleCount = Math.max(leadTopics.length, Math.min(LEAD_TOPICS.length, orderedTopics.length));
  const selectedIndex = orderedTopics.findIndex((t) => t.slug === topic);
  const visibleTopics = showAllTopics || selectedIndex >= visibleCount ? orderedTopics : orderedTopics.slice(0, visibleCount);
  const selectedTopic = selectedIndex >= 0 ? orderedTopics[selectedIndex] : null;
  const topicBase = isDaily && !archive ? currentAffairsMeta.HUB_PATH : currentAffairsMeta.archivePath("daily");
  const topicHref = (slug: string | null) => withParams(topicBase, { topic: slug ?? undefined });

  // The old ?type= tabs now live at their own archive URLs.
  if (legacyType) {
    const target = currentAffairsMeta.isArchiveType(legacyType) ? currentAffairsMeta.archivePath(legacyType) : currentAffairsMeta.HUB_PATH;
    return <Navigate to={withLang(target)} replace />;
  }

  const pageTitle = archive ? `${tab.label} Current Affairs${page > 1 ? ` - Page ${page}` : ""}` : "Current Affairs";
  const pageDescription = archive
    ? isDaily
      ? "Every story from Testkart's daily current affairs digests, newest first, for UPSC, SSC, banking and other competitive exams."
      : `Every ${tab.noun[0]} on Testkart, newest first, for UPSC, SSC, banking and other competitive exams.`
    : "Daily, weekly and monthly current affairs digests for UPSC, SSC, banking and other competitive exams.";
  const canonicalPath = archive ? currentAffairsMeta.archivePath(archive, page) : currentAffairsMeta.HUB_PATH;
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;

  const renderPager = () => {
    if (totalPages <= 1 || shownCount === 0) return null;
    const href = (n: number) => withParams(currentAffairsMeta.archivePath(type, n), { topic });
    return (
      <nav className={styles.pager} aria-label={`${tab.label} digest pages`}>
        {page > 1 ? (
          <Link to={href(page - 1)} className={styles.pagerStep} rel="prev">
            <ChevronLeft size={15} aria-hidden="true" /> Newer
          </Link>
        ) : (
          <span className={`${styles.pagerStep} ${styles.pagerDisabled}`} aria-hidden="true">
            <ChevronLeft size={15} /> Newer
          </span>
        )}
        <ol className={styles.pagerList}>
          {pageWindow(page, totalPages).map((n, index) =>
            n === "gap" ? (
              <li key={`gap-${index}`} className={styles.pagerGap} aria-hidden="true">
                ...
              </li>
            ) : (
              <li key={n}>
                <Link
                  to={href(n)}
                  className={`${styles.pagerNumber} ${archive && n === page ? styles.pagerCurrent : ""}`}
                  aria-current={archive && n === page ? "page" : undefined}
                  aria-label={`Page ${n}`}
                >
                  {n}
                </Link>
              </li>
            )
          )}
        </ol>
        {page < totalPages ? (
          <Link to={href(page + 1)} className={styles.pagerStep} rel="next">
            Older <ChevronRight size={15} aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${styles.pagerStep} ${styles.pagerDisabled}`} aria-hidden="true">
            Older <ChevronRight size={15} />
          </span>
        )}
      </nav>
    );
  };

  const renderList = () => {
    if (active.isPending || stale) return isDaily ? <StorySkeleton /> : <ListSkeleton />;
    if (active.isError && shownCount === 0) {
      return (
        <div className={styles.state} role="alert">
          <span className={styles.stateIcon} aria-hidden="true">
            <AlertCircle size={20} />
          </span>
          <p className={styles.stateTitle}>{isDaily ? "These stories could not be loaded" : "These digests could not be loaded"}</p>
          <p>Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={() => active.refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (shownCount === 0) {
      const Icon = tab.icon;
      const pastEnd = page > 1 && total > 0;
      if (topic && !pastEnd) {
        return (
          <div className={`${styles.state} ${styles.state_daily}`}>
            <span className={styles.stateIcon} aria-hidden="true">
              <Icon size={20} />
            </span>
            <p className={styles.stateTitle}>No stories tagged {selectedTopic?.name ?? topic} yet</p>
            <p>Stories on this topic appear here as soon as a daily digest covers it.</p>
            <Link to={topicHref(null)} {...tabLinkProps} className={styles.stateLink}>
              Show all daily stories <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        );
      }
      return (
        <div className={`${styles.state} ${styles[`state_${type}`] ?? ""}`}>
          <span className={styles.stateIcon} aria-hidden="true">
            <Icon size={20} />
          </span>
          <p className={styles.stateTitle}>{pastEnd ? "This page is empty" : `No ${tab.noun[1]} yet`}</p>
          <p>{pastEnd ? `There are fewer ${tab.noun[1]} than that.` : `New ${tab.noun[1]} appear here as soon as they are published.`}</p>
          {pastEnd ? (
              <Link to={withParams(currentAffairsMeta.archivePath(type), { topic })} className={styles.stateLink}>
              Newest {tab.noun[1]} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            type !== "daily" && (
              <Link to={withLang(currentAffairsMeta.archivePath("daily"))} {...tabLinkProps} className={styles.stateLink}>
                Browse daily digests <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )
          )}
        </div>
      );
    }
    if (isDaily) {
      return (
        <>
          <ul className={styles.stories} aria-busy={stories.isPlaceholderData}>
            {storyRows.map((story) => (
              <StoryRow key={story.id} story={story} />
            ))}
          </ul>
          {renderPager()}
        </>
      );
    }
    return (
      <>
        <ul className={styles.list} aria-busy={list.isPlaceholderData}>
          {rows.map((card) => (
            <DigestRow key={card.id} card={card} />
          ))}
        </ul>
        {renderPager()}
      </>
    );
  };

  return (
    <>
      <SEOHead title={pageTitle} description={pageDescription} url={canonicalUrl} />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
              { "@type": "ListItem", position: 2, name: "Current Affairs", item: `${SITE_ORIGIN}${currentAffairsMeta.HUB_PATH}` },
              ...(archive
                ? [
                    {
                      "@type": "ListItem",
                      position: 3,
                      name: `${tab.label} Current Affairs`,
                      item: `${SITE_ORIGIN}${currentAffairsMeta.archivePath(archive)}`,
                    },
                  ]
                : []),
            ],
          })}
        </script>
      </Helmet>

      <div className={`${styles.page} ${className ?? ""}`}>
        <header className={styles.intro}>
          <div className={styles.introText}>
            <span className={styles.introEyebrow}>
              <span className={styles.accentBar} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Exam-ready news, every day
            </span>
            <h1 className={styles.title}>{archive ? `${tab.label} Current Affairs` : "Current Affairs"}</h1>
            <p className={styles.subtitle}>Daily, weekly and monthly digests for UPSC, SSC and other competitive exams.</p>
          </div>
          {updatedLabel && (
            <p className={styles.updated}>
              <span className={styles.updatedDot} aria-hidden="true" />
              Updated {updatedLabel}
            </p>
          )}
        </header>

        <div className={styles.layout}>
          <div className={styles.tabBar}>
            <nav aria-label="Digest type">
              <ul className={styles.tabs}>
                {TABS.map((t) => (
                  <li key={t.value}>
                    <Link
                      to={withLang(currentAffairsMeta.archivePath(t.value))}
                      {...tabLinkProps}
                      className={`${styles.tab} ${t.value === type ? styles.tabOn : ""}`}
                      aria-current={archive === t.value ? "page" : undefined}
                    >
                      {t.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <section ref={mainRef} className={styles.main} aria-labelledby="ca-list-title">
            <h2 id="ca-list-title" className={styles.srOnly}>
              {tab.label} current affairs{selectedTopic ? `: ${selectedTopic.name}` : ""}
            </h2>
            {topic && (
              <div className={styles.filterNotice} role="status">
                <span>
                  Showing stories on <strong>{selectedTopic?.name ?? topic}</strong>
                  {stories.data && !stories.isPlaceholderData ? ` (${total})` : ""}
                </span>
                <Link to={topicHref(null)} {...tabLinkProps} className={styles.filterClear}>
                  <X size={14} aria-hidden="true" /> Clear filter
                </Link>
              </div>
            )}
            {renderList()}
          </section>

          <aside className={styles.sidebar} aria-label="More from Testkart">
            <section className={styles.sideSection} aria-labelledby="ca-topics-title">
              <div className={styles.sideHead}>
                <h2 id="ca-topics-title" className={styles.sideHeading}>
                  Explore Topics
                </h2>
                {topic && (
                  <Link to={topicHref(null)} {...tabLinkProps} className={styles.sideMore}>
                    Clear filters
                  </Link>
                )}
              </div>
              <div className={`${styles.sideCard} ${styles.topicCard}`}>
                {hub.isPending ? (
                  <Skeleton style={{ height: "7.5rem", borderRadius: "var(--radius-md)" }} />
                ) : orderedTopics.length === 0 ? (
                  <p className={styles.sideEmpty}>Topics appear here once stories are tagged.</p>
                ) : (
                  <>
                    <ul className={styles.topicList}>
                      {visibleTopics.map((t, index) => {
                        const active = t.slug === topic;
                        return (
                          <li key={t.slug}>
                            <Link
                              to={topicHref(active ? null : t.slug)}
                              {...tabLinkProps}
                              className={`${styles.topicChip} ${styles[TOPIC_TONES[index % TOPIC_TONES.length]]} ${active ? styles.topicChipOn : ""}`}
                              aria-current={active ? "true" : undefined}
                              title={active ? `Remove the ${t.name} filter` : `Show stories on ${t.name}`}
                            >
                              {active && <Check size={13} aria-hidden="true" />}
                              {t.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    {orderedTopics.length > visibleCount && selectedIndex < visibleCount && (
                      <button type="button" className={styles.topicMore} onClick={() => setShowAllTopics((open) => !open)} aria-expanded={showAllTopics}>
                        {showAllTopics ? "Show fewer topics" : `View all topics (${orderedTopics.length})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className={styles.sideSection} aria-labelledby="ca-months-title">
              <div className={styles.sideHead}>
                <h2 id="ca-months-title" className={styles.sideHeading}>
                  Monthly Current Affairs
                </h2>
                {monthTotal > monthCards.length && (
                  <Link to={withLang(currentAffairsMeta.archivePath("monthly"))} {...tabLinkProps} className={styles.sideMore}>
                    View all
                  </Link>
                )}
              </div>
              {months.isPending ? (
                <Skeleton style={{ height: "17rem", borderRadius: "var(--radius-lg)" }} />
              ) : monthCards.length > 0 ? (
                <ul className={styles.monthList}>
                  {monthCards.map((card) => (
                    <MonthCard key={card.id} card={card} />
                  ))}
                </ul>
              ) : (
                <p className={`${styles.sideCard} ${styles.sideEmpty}`}>Monthly digests appear here once published.</p>
              )}
            </section>

            {weekly && <WeeklyCard card={weekly} />}

            <section className={styles.sideSection} aria-labelledby="ca-teachers-title">
              <h2 id="ca-teachers-title" className={styles.sideHeading}>
                From teachers on Testkart
              </h2>
              <div className={`${styles.sideCard} ${styles.teacherCard}`}>
                {hub.isPending ? (
                  <Skeleton style={{ height: "10rem", borderRadius: "var(--radius-md)" }} />
                ) : (
                  <CurrentAffairsTeacherPicks examId={pickExamId} />
                )}
              </div>
            </section>

            <section className={styles.sideSection} aria-labelledby="ca-daily-title">
              <h2 id="ca-daily-title" className={styles.sideHeading}>
                Get it daily
              </h2>
              <div className={`${styles.sideCard} ${styles.dailyCard}`}>
                <p className={styles.sideText}>Follow Testkart on Telegram for new digests and exam updates.</p>
                <Button asChild size="sm" className={styles.telegramButton}>
                  <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
                    <FaTelegram aria-hidden="true" /> Join on Telegram
                  </a>
                </Button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
};
