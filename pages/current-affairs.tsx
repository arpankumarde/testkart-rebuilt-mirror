import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, Calendar, CalendarDays, CalendarRange, Newspaper } from "lucide-react";
import { FaTelegram } from "react-icons/fa6";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { CurrentAffairsTeacherPicks } from "../components/CurrentAffairsTeacherPicks";
import { useCurrentAffairsFeed, useCurrentAffairsHub } from "../helpers/useCurrentAffairsPublic";
import type { PublicDigestCard } from "../endpoints/current-affairs/hub_GET.schema";
import type { CurrentAffairsContentType } from "../helpers/schema";
import styles from "./current-affairs.module.css";

const SITE_ORIGIN = "https://testkart.in";
const CANONICAL_URL = `${SITE_ORIGIN}/current-affairs`;
const PAGE_TITLE = "Current Affairs";
const PAGE_DESCRIPTION =
  "Daily, weekly and monthly current affairs digests for UPSC, SSC, banking and other competitive exams.";
const ROW_TAGS = 3;
const SIDEBAR_MONTHS = 3;
const TELEGRAM_URL = "https://t.me/testkart_in";

/* Public sections of the site, named as the header and footer name them. */
const EXPLORE_LINKS = [
  { to: "/course", label: "Courses" },
  { to: "/mock-test", label: "Test Series" },
  { to: "/live-test", label: "Live Competitions" },
  { to: "/study-notes", label: "Study Notes" },
  { to: "/bundles", label: "Course Bundles" },
  { to: "/exams", label: "Exams" },
  { to: "/blog", label: "Blog" },
  { to: "/teach", label: "Teach on Testkart" },
];

type FeedType = "daily" | "weekly" | "monthly";

const TABS: { value: FeedType; label: string; noun: [string, string]; icon: typeof CalendarDays }[] = [
  { value: "daily", label: "Daily", noun: ["daily digest", "daily digests"], icon: CalendarDays },
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

const digestHref = (card: PublicDigestCard) => `/current-affairs/${card.slug}`;
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

const CurrentAffairsPage: React.FC = () => {
  const [params] = useSearchParams();
  const typeParam = params.get("type");
  const type: FeedType = typeParam === "weekly" || typeParam === "monthly" ? typeParam : "daily";
  const langParam = params.get("lang");
  const lang = langParam === "en" || langParam === "hi" ? langParam : undefined;
  const tab = TABS.find((t) => t.value === type)!;

  const hub = useCurrentAffairsHub({ lang });
  const feed = useCurrentAffairsFeed({ type, lang });
  const months = useCurrentAffairsFeed({ type: "monthly", lang });

  const rows = feed.data?.pages.flatMap((p) => p.rows) ?? [];
  const total = feed.data?.pages[0]?.total ?? 0;
  const monthCards = (months.data?.pages[0]?.rows ?? []).slice(0, SIDEBAR_MONTHS);
  const monthTotal = months.data?.pages[0]?.total ?? 0;
  const weekly = hub.data?.weekly ?? null;
  const pickExamId = hub.data?.latestDaily?.tags.find((t) => t.kind === "exam" && t.examId)?.examId ?? null;

  const lastPublished = (hub.data?.latest ?? [])
    .map((c) => (c.publishedAt ? new Date(c.publishedAt).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  const updatedLabel = lastPublished
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(
        new Date(lastPublished)
      )
    : null;

  const tabHref = (value: FeedType) => {
    const next = new URLSearchParams();
    if (value !== "daily") next.set("type", value);
    if (lang) next.set("lang", lang);
    const query = next.toString();
    return `/current-affairs${query ? `?${query}` : ""}`;
  };

  const tabLinkProps = { replace: true, preventScrollReset: true, state: { preserveScroll: true } };

  const renderList = () => {
    if (feed.isPending) return <ListSkeleton />;
    if (feed.isError && rows.length === 0) {
      return (
        <div className={styles.state} role="alert">
          <span className={styles.stateIcon} aria-hidden="true">
            <AlertCircle size={20} />
          </span>
          <p className={styles.stateTitle}>These digests could not be loaded</p>
          <p>Check your connection and try again.</p>
          <Button variant="outline" size="sm" onClick={() => feed.refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (rows.length === 0) {
      const Icon = tab.icon;
      return (
        <div className={`${styles.state} ${styles[`state_${type}`] ?? ""}`}>
          <span className={styles.stateIcon} aria-hidden="true">
            <Icon size={20} />
          </span>
          <p className={styles.stateTitle}>No {tab.noun[1]} yet</p>
          <p>New {tab.noun[1]} appear here as soon as they are published.</p>
          {type !== "daily" && (
            <Link to={tabHref("daily")} {...tabLinkProps} className={styles.stateLink}>
              Browse daily digests <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      );
    }
    return (
      <>
        <ul className={styles.list} aria-busy={feed.isFetchingNextPage}>
          {rows.map((card) => (
            <DigestRow key={card.id} card={card} />
          ))}
        </ul>
        {feed.hasNextPage && (
          <div className={styles.more}>
            <Button variant="outline" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
              {feed.isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
            <span className={styles.moreCount}>
              Showing {rows.length} of {total}
            </span>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <SEOHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} url={CANONICAL_URL} />
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
            <span className={styles.introEyebrow}>
              <span className={styles.accentBar} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Exam-ready news, every day
            </span>
            <h1 className={styles.title}>Current Affairs</h1>
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
                      to={tabHref(t.value)}
                      {...tabLinkProps}
                      className={`${styles.tab} ${t.value === type ? styles.tabOn : ""}`}
                      aria-current={t.value === type ? "page" : undefined}
                    >
                      {t.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <section className={styles.main} aria-labelledby="ca-list-title">
            <h2 id="ca-list-title" className={styles.srOnly}>
              {tab.label} current affairs
            </h2>
            {renderList()}
          </section>

          <aside className={styles.sidebar} aria-label="More from Testkart">
            <section className={styles.sideSection} aria-labelledby="ca-explore-title">
              <h2 id="ca-explore-title" className={styles.sideHeading}>
                Explore Testkart
              </h2>
              <ul className={`${styles.sideCard} ${styles.exploreList}`}>
                {EXPLORE_LINKS.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className={styles.exploreLink}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.sideSection} aria-labelledby="ca-months-title">
              <div className={styles.sideHead}>
                <h2 id="ca-months-title" className={styles.sideHeading}>
                  Monthly Current Affairs
                </h2>
                {monthTotal > monthCards.length && (
                  <Link to={tabHref("monthly")} {...tabLinkProps} className={styles.sideMore}>
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

export default CurrentAffairsPage;
