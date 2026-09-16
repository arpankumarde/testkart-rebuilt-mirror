import React, { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Star } from "lucide-react";
import { FaYoutube } from "react-icons/fa6";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { TeacherProductCard } from "./HomepageContentSection";
import { useTeacherPublicProfileQuery } from "../helpers/useTeacherPublicProfile";
import { computeTeacherProfileStats } from "../helpers/teacherProfileStats";
import { formatItemPrice } from "../helpers/homepageItemUtils";
import { Placeholder } from "../helpers/placeholderImages";
import { swmgPromoContent, type SwmgFaqItem, type SwmgVideo } from "../helpers/swmgPromoContent";
import styles from "./SwmgPromo.module.css";

const content = swmgPromoContent;

const NBSP = String.fromCharCode(160);

/** Keeps "Dr." on the same line as the name that follows it. */
const keepHonorific = (text: React.ReactNode) =>
  typeof text === "string" ? text.replace(/\bDr\. /g, `Dr.${NBSP}`) : text;

type ActionProps = {
  to?: string;
  href?: string;
  variant?: "solid" | "outline";
  children: React.ReactNode;
};

/** A link styled for the coral brand blocks: solid ink or ink outline. */
export const SwmgBrandAction = ({ to, href, variant = "solid", children }: ActionProps) => {
  const className = variant === "solid" ? styles.brandSolid : styles.brandOutline;
  return (
    <Button asChild size="lg" variant={variant === "solid" ? "primary" : "outline"} className={className}>
      {to ? (
        <Link to={to}>{children}</Link>
      ) : (
        <a href={href} {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {children}
        </a>
      )}
    </Button>
  );
};

type Crumb = { label: string; to?: string };

type HeroProps = {
  chip: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  lede: React.ReactNode;
  actions: React.ReactNode;
  breadcrumbs: Crumb[];
  showCredentials?: boolean;
  compact?: boolean;
};

export const SwmgPromoHero = ({
  chip,
  title,
  subtitle,
  lede,
  actions,
  breadcrumbs,
  showCredentials = false,
  compact = false,
}: HeroProps) => (
  <section className={`${styles.hero} ${compact ? styles.heroCompact : ""}`}>
    <div className={styles.heroInner}>
      <div className={styles.heroText}>
        <nav aria-label="Breadcrumb" className={styles.crumbs}>
          <ol className={styles.crumbList}>
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.label} className={styles.crumbItem}>
                {index > 0 && (
                  <span className={styles.crumbSeparator} aria-hidden="true">
                    /
                  </span>
                )}
                {crumb.to ? (
                  <Link to={crumb.to} className={styles.crumbLink}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <span className={styles.chip}>{chip}</span>

        <h1 className={styles.heroTitle}>
          {keepHonorific(title)}
          {subtitle && <span className={styles.heroSubtitle}>{keepHonorific(subtitle)}</span>}
        </h1>

        <p className={styles.heroLede}>{lede}</p>

        <div className={styles.heroActions}>{actions}</div>

        {showCredentials && (
          <dl className={styles.credentials}>
            {content.credentials.map((item) => (
              <div key={item.label} className={styles.credential}>
                <dt className={styles.credentialLabel}>{item.label}</dt>
                <dd className={styles.credentialValue}>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className={styles.heroPortrait}>
        <img
          src={content.portrait.src900}
          srcSet={`${content.portrait.src600} 600w, ${content.portrait.src900} 900w`}
          sizes={compact ? "(max-width: 860px) 12rem, 21rem" : "(max-width: 860px) 20rem, 26rem"}
          width={content.portrait.width}
          height={content.portrait.height}
          alt={`${content.name}, UGC NET Environmental Science and Paper 1 educator and founder of SWMG`}
          className={styles.portraitImage}
          fetchPriority="high"
          decoding="async"
        />
      </div>
    </div>
  </section>
);

const PAGE_LINKS = [
  { key: "overview", label: "Overview", to: content.paths.overview },
  { key: "evs", label: "Environmental Science syllabus and plan", to: content.paths.evs },
  { key: "reviews", label: "Student results and reviews", to: content.paths.reviews },
] as const;

export const SwmgPageNav = ({ active }: { active: (typeof PAGE_LINKS)[number]["key"] }) => (
  <nav className={styles.pageNav} aria-label={`${content.name} pages`}>
    <ul className={styles.pageNavList}>
      {PAGE_LINKS.map((link) => (
        <li key={link.key}>
          <Link
            to={link.to}
            className={styles.pageNavLink}
            aria-current={link.key === active ? "page" : undefined}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);

type SectionProps = {
  id?: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export const SwmgSection = ({ id, title, intro, children, className }: SectionProps) => (
  <section id={id} className={`${styles.section} ${className ?? ""}`}>
    <div className={styles.sectionHead}>
      <h2 className={styles.sectionTitle}>{keepHonorific(title)}</h2>
      {intro && <p className={styles.sectionIntro}>{intro}</p>}
    </div>
    {children}
  </section>
);

export const SwmgPageBody = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.page}>{children}</div>
);

export const SwmgVideoGrid = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.videoGrid}>{children}</div>
);

export const SwmgTextLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className={styles.textLink}>
    {children}
  </Link>
);

type CatalogProps = {
  /** Keeps only items whose title or exam name matches, e.g. Environmental Science. */
  match?: RegExp;
  emptyTitle: string;
  emptyText: string;
};

export const SwmgCatalog = ({ match, emptyTitle, emptyText }: CatalogProps) => {
  const { data, isFetching } = useTeacherPublicProfileQuery(content.teacherSlug);

  const cards = useMemo(() => {
    if (!data) return [];
    const { teacher, courses, tests, liveTests, products } = data;
    const keep = (title: string, examName: string | null | undefined) =>
      !match || match.test(title) || (!!examName && match.test(examName));
    const teacherProps = {
      teacherName: teacher.displayName,
      teacherAvatarUrl: teacher.avatarUrl ?? null,
      teacherTagline: teacher.tagline ?? null,
      teacherYearsOfExperience: teacher.yearsOfExperience ?? null,
      teacherSlug: teacher.slug ?? null,
      teacherIsVerified: !!teacher.isVerified,
    };

    return [
      ...courses
        .filter((course) => keep(course.title, course.examName))
        .map((course) => (
          <TeacherProductCard
            key={`course-${course.id}`}
            {...teacherProps}
            link={`/course/${course.slug}`}
            productTitle={course.title}
            examName={course.examName}
            stats="Course"
            priceLabel={formatItemPrice(course.price)}
            isFree={course.price === 0}
            thumbnailUrl={course.thumbnailImageUrl}
            placeholderUrl={Placeholder.COURSE}
          />
        )),
      ...tests
        .filter((test) => keep(test.title, test.examName))
        .map((test) => (
          <TeacherProductCard
            key={`test-${test.id}`}
            {...teacherProps}
            link={`/mock-test/${test.slug}`}
            productTitle={test.title}
            examName={test.examName}
            stats="Test series"
            priceLabel={formatItemPrice(test.price, test.discountPrice)}
            isFree={(test.discountPrice ?? test.price) === 0}
            thumbnailUrl={test.thumbnailUrl}
            placeholderUrl={Placeholder.TEST}
          />
        )),
      ...liveTests
        .filter((liveTest) => keep(liveTest.title, liveTest.examName))
        .map((liveTest) => (
          <TeacherProductCard
            key={`live-${liveTest.id}`}
            {...teacherProps}
            link={`/mock-test/live/${liveTest.id}`}
            productTitle={liveTest.title}
            examName={liveTest.examName}
            stats="Live test"
            priceLabel={formatItemPrice(liveTest.price)}
            isFree={liveTest.price === 0}
            thumbnailUrl={liveTest.thumbnailUrl}
            placeholderUrl={Placeholder.LIVE}
          />
        )),
      ...products
        .filter((product) => keep(product.title, product.examName))
        .map((product) => (
          <TeacherProductCard
            key={`product-${product.id}`}
            {...teacherProps}
            link={`/study-notes/${product.slug}`}
            productTitle={product.title}
            examName={product.examName}
            stats={product.pageCount ? `Notes, ${product.pageCount} pages` : "Notes"}
            priceLabel={formatItemPrice(product.price)}
            isFree={product.price === 0}
          />
        )),
    ];
  }, [data, match]);

  if (!data && isFetching) {
    return (
      <div className={styles.catalogGrid} aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className={styles.catalogSkeleton} />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className={styles.emptyPanel}>
        <h3 className={styles.emptyTitle}>{emptyTitle}</h3>
        <p className={styles.emptyText}>{emptyText}</p>
        <div className={styles.emptyActions}>
          <Button asChild variant="primary" size="lg">
            <a href={content.channels.evs.url} target="_blank" rel="noopener noreferrer">
              <FaYoutube size={18} aria-hidden="true" />
              Watch his free classes
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to={`/expert/${content.teacherSlug}`}>Follow his Testkart profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <div className={styles.catalogGrid}>{cards}</div>;
};

/** Testkart ratings for his published items. Shows nothing invented: no ratings, no stars. */
export const SwmgRatings = () => {
  const { data } = useTeacherPublicProfileQuery(content.teacherSlug);
  const stats = data ? computeTeacherProfileStats(data) : null;

  if (!stats || stats.rating === null) {
    return (
      <div className={styles.emptyPanel}>
        <h3 className={styles.emptyTitle}>No Testkart ratings yet</h3>
        <p className={styles.emptyText}>
          Only students who enrol in {content.name}'s courses on Testkart can rate them. Their ratings will show here
          as they come in.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.ratingPanel}>
      <p className={styles.ratingValue}>
        <Star size={28} aria-hidden="true" className={styles.ratingStar} />
        {stats.rating.toFixed(1)}
        <span className={styles.ratingScale}> out of 5</span>
      </p>
      <p className={styles.emptyText}>
        From {stats.reviews.toLocaleString("en-IN")} {stats.reviews === 1 ? "rating" : "ratings"} by students
        enrolled in his Testkart courses and tests.
      </p>
    </div>
  );
};

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
};

const formatUploadDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));

const HAS_DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Thumbnail first, player on click, so a page with a dozen videos does not
 * load a dozen YouTube iframes before anyone presses play.
 */
export const SwmgVideoCard = ({
  video,
  featured = false,
  headingLevel = 3,
}: {
  video: SwmgVideo;
  featured?: boolean;
  headingLevel?: 3 | 4;
}) => {
  const [playing, setPlaying] = useState(false);
  const channel = content.channels[video.channel];
  const HeadingTag = headingLevel === 3 ? "h3" : "h4";

  return (
    <article className={`${styles.video} ${featured ? styles.videoFeatured : ""}`}>
      <div className={styles.videoFrame}>
        {playing ? (
          <iframe
            className={styles.videoIframe}
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className={styles.videoButton} onClick={() => setPlaying(true)}>
            <img
              src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
              alt=""
              width={480}
              height={360}
              loading="lazy"
              decoding="async"
              className={styles.videoThumb}
            />
            <span className={styles.videoPlay}>
              <Play size={16} aria-hidden="true" fill="currentColor" />
              Play video
              <span className={styles.srOnly}>: {video.title}</span>
            </span>
            <span className={styles.videoDuration}>{formatDuration(video.durationSeconds)}</span>
          </button>
        )}
      </div>
      <div className={styles.videoBody}>
        <HeadingTag className={styles.videoTitle} lang={HAS_DEVANAGARI.test(video.title) ? "hi" : undefined}>
          {video.title}
        </HeadingTag>
        <p className={styles.videoSummary}>{video.summary}</p>
        <p className={styles.videoMeta}>
          <a href={channel.url} target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>
            {channel.name}
          </a>
          <span aria-hidden="true"> | </span>
          {formatUploadDate(video.uploadDate)}
        </p>
      </div>
    </article>
  );
};

export const SwmgChannelCards = () => (
  <div className={styles.channelGrid}>
    {[content.channels.paper1, content.channels.evs].map((channel) => (
      <a
        key={channel.name}
        href={channel.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.channelCard}
      >
        <span className={styles.channelIcon} aria-hidden="true">
          <FaYoutube size={22} />
        </span>
        <span className={styles.channelName}>{channel.name}</span>
        <span className={styles.channelStats}>
          {channel.subscribers}, {channel.videos}
        </span>
        <span className={styles.channelFocus}>{channel.focus}</span>
        <span className={styles.channelCta}>Open channel on YouTube</span>
      </a>
    ))}
  </div>
);

export const SwmgFaq = ({ items }: { items: SwmgFaqItem[] }) => (
  <dl className={styles.faqList}>
    {items.map((item) => (
      <div key={item.question} className={styles.faqItem}>
        <dt className={styles.faqQuestion}>{item.question}</dt>
        <dd className={styles.faqAnswer}>{item.answer}</dd>
      </div>
    ))}
  </dl>
);

export const SwmgClosingCta = ({
  title,
  text,
  actions,
}: {
  title: React.ReactNode;
  text: string;
  actions: React.ReactNode;
}) => {
  const titleId = useId();
  return (
    <aside className={styles.closing} aria-labelledby={titleId}>
      <span className={styles.chip}>SWMG on Testkart</span>
      <h2 id={titleId} className={styles.closingTitle}>
        {title}
      </h2>
      <p className={styles.closingText}>{text}</p>
      <div className={styles.heroActions}>{actions}</div>
    </aside>
  );
};

export const swmgVideoJsonLd = (video: SwmgVideo) => ({
  "@type": "VideoObject",
  name: video.title,
  description: video.summary,
  thumbnailUrl: [`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`],
  uploadDate: video.uploadDate,
  duration: `PT${Math.floor(video.durationSeconds / 60)}M${video.durationSeconds % 60}S`,
  embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
  contentUrl: `https://www.youtube.com/watch?v=${video.id}`,
});

export const swmgFaqJsonLd = (items: SwmgFaqItem[]) => ({
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
});

export const swmgBreadcrumbJsonLd = (trail: { name: string; path: string }[]) => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: `${content.siteUrl}${item.path}`,
  })),
});

export const swmgPersonJsonLd = () => ({
  "@type": "Person",
  "@id": `${content.siteUrl}${content.paths.overview}#person`,
  name: content.name,
  alternateName: "SWMG",
  image: content.portrait.src900,
  jobTitle: "UGC NET Educator",
  description:
    "JRF-qualified educator with a Ph.D. in Environmental Science, founder of SWMG (Success with Mukesh Goyal), teaching UGC NET Environmental Science Paper 2 and Paper 1.",
  url: `${content.siteUrl}${content.paths.overview}`,
  knowsAbout: ["UGC NET Environmental Science", "UGC NET Paper 1", "Environmental Science", "NET JRF preparation"],
  knowsLanguage: ["hi", "en"],
  homeLocation: { "@type": "Place", name: "Hisar, Haryana, India" },
  hasCredential: [
    { "@type": "EducationalOccupationalCredential", name: "Ph.D. in Environmental Science", credentialCategory: "degree" },
    { "@type": "EducationalOccupationalCredential", name: "UGC NET Junior Research Fellowship (JRF)" },
  ],
  worksFor: { "@type": "Organization", name: "SWMG - Success with Mukesh Goyal", url: "https://www.swmg.in" },
  sameAs: [...content.sameAs, `${content.siteUrl}/expert/${content.teacherSlug}`],
});
