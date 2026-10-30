import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  GraduationCap,
  Languages,
  Lightbulb,
  MapPin,
  MessageSquare,
  Share2,
  ShoppingBag,
  Star,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin, FaTelegram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { normalizeSocialUrl, SocialPlatform } from "../helpers/socialProfileUrl";
import type { OutputType } from "../endpoints/teachers/profile_GET.schema";
import type { AwardCertificate } from "../helpers/teacherProfileTypes";
import { computeTeacherProfileStats, formatStatCount } from "../helpers/teacherProfileStats";
import { getOrganizationProfilePath } from "../helpers/organizationRoutes";
import { bundlePriceProps, itemPriceProps } from "../helpers/homepageItemUtils";
import { Placeholder } from "../helpers/placeholderImages";
import { formatCalendarMonthYear } from "../helpers/calendarDate";
import { liveTestPath } from "../helpers/liveTestRoutes";
import { EXPERT_PROFILE_SHARE_CAMPAIGN } from "../helpers/shareLinks";
import { ExpertResourceCard } from "./ExpertResourceCard";
import { ShareAssetDialog } from "./ShareAssetDialog";
import { VerifiedBadge } from "./VerifiedBadge";
import { TeacherCtaBanner } from "./TeacherCtaBanner";
import { FollowTeacherButton } from "./FollowTeacherButton";
import { TeacherPostsSection } from "./TeacherPostsSection";
import { Button } from "./Button";
import styles from "./ExpertProfileView.module.css";

type CatalogueFilter = "courses" | "tests" | "live" | "products" | "bundles";
type ActiveFilter = "all" | CatalogueFilter;

interface ExpertProfileViewProps {
  data: OutputType;
  /**
   * "preview" is the same page rendered inside the teacher's own dashboard,
   * so it drops a size step and leaves out the follow action.
   */
  variant?: "page" | "preview";
  /** Opens the catalogue on that category, for ?tab= links. */
  initialFilter?: CatalogueFilter | null;
  className?: string;
}

const GROUP_LABELS: Record<CatalogueFilter, string> = {
  courses: "Courses",
  tests: "Test Series",
  live: "Live Tests",
  products: "Study Notes & PDFs",
  bundles: "Bundles",
};

const TAG_TONES = ["toneLavender", "toneMint", "tonePowder", "toneButter"] as const;
const DETAIL_TONES = ["toneLavender", "toneMint", "tonePowder", "toneButter", "toneSage", "tonePeach"] as const;

// There are no separate profile fields for teaching approach or education, so
// the About section sorts what the teacher already wrote. After the opening
// paragraph, a bio paragraph about how they teach goes under Teaching approach.
// An award that reads as a degree, exam qualification or certificate goes under
// Education & qualifications, and the rest stay in Awards. Nothing is invented.
const APPROACH_PATTERN =
  /\b(approach|method(?:ology)?|classes|sessions|lectures|students?|practi[cs]e|revision|concepts?|step[- ]by[- ]step)\b/i;
// Matched on the title only. Bare exam names ("UGC NET") are left out on
// purpose: they turn up in channel names and lesson counts as often as in
// qualifications, so a qualifier word or a degree has to be present.
const QUALIFICATION_PATTERN =
  /\b(b\.?\s?(?:a|sc|ed|tech|com|e)|m\.?\s?(?:a|sc|ed|tech|com|phil)|mba|ph\.?\s?d|degree|bachelor'?s?|master'?s?|doctorate|universit(?:y|ies)|graduat\w*|post[- ]?graduat\w*|diploma|certifi\w*|qualified|qualifying|cleared|jrf)\b/i;

const splitBio = (bio: string | null | undefined) => {
  const paragraphs = (bio ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const intro: string[] = [];
  const approach: string[] = [];
  paragraphs.forEach((paragraph, index) => {
    if (index > 0 && APPROACH_PATTERN.test(paragraph)) approach.push(paragraph);
    else intro.push(paragraph);
  });
  return { intro, approach };
};

const splitAwards = (awards: AwardCertificate[]) => {
  const education: AwardCertificate[] = [];
  const achievements: AwardCertificate[] = [];
  awards.forEach((award) => {
    if (QUALIFICATION_PATTERN.test(award.title)) education.push(award);
    else achievements.push(award);
  });
  return { education, achievements };
};

const BIO_BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

/**
 * A bio paragraph as written, except that lines typed as "- item" become a
 * real list, with any lead-in lines kept as a paragraph above it.
 */
const BioParagraph = ({ text }: { text: string }) => {
  const lines = text.split("\n");
  const firstBullet = lines.findIndex((line) => BIO_BULLET.test(line));
  const bullets = firstBullet === -1 ? [] : lines.slice(firstBullet);
  if (bullets.length < 2 || !bullets.every((line) => BIO_BULLET.test(line) || !line.trim())) return <p>{text}</p>;
  const lead = lines.slice(0, firstBullet).join("\n").trim();
  return (
    <>
      {lead && <p>{lead}</p>}
      <ul>
        {bullets
          .filter((line) => line.trim())
          .map((line, i) => (
            <li key={i}>{line.replace(BIO_BULLET, "")}</li>
          ))}
      </ul>
    </>
  );
};

const formatLiveStatus = (status: string) => {
  const text = status.replace(/_/g, " ").trim().toLowerCase();
  return text ? text[0].toUpperCase() + text.slice(1) : null;
};

const bundleSavePercent = (price: number, originalPrice: number) =>
  originalPrice > price && originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : null;

interface CatalogueGroupProps {
  id: CatalogueFilter;
  title: string;
  cards: React.ReactNode[];
  /** Showing every card, because this category is the selected filter. */
  expanded: boolean;
  onViewAll: () => void;
}

const CatalogueGroup: React.FC<CatalogueGroupProps> = ({ id, title, cards, expanded, onViewAll }) => {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(3);

  // The column count comes from a container query, so read it off the resolved
  // template: "one row" then means one row at every width, the dashboard
  // preview included.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const count = window.getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      if (count > 0) setColumns(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const initialCount = columns === 1 ? 3 : columns;
  const shownCards = expanded ? cards : cards.slice(0, initialCount);
  const hasMore = shownCards.length < cards.length;

  return (
    <section className={styles.group} aria-labelledby={`expert-group-${id}`}>
      <div className={styles.groupHead}>
        <h3 id={`expert-group-${id}`} className={styles.groupTitle}>
          {title}
        </h3>
        {hasMore && (
          <button type="button" className={styles.viewAll} onClick={onViewAll}>
            View all
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className={styles.grid} ref={gridRef}>
        {shownCards}
      </div>
    </section>
  );
};

const formatJoined = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "MMMM yyyy");
};

const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "T";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
};

const smoothScroll = (node: HTMLElement | null) => {
  if (!node) return;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
};

export const ExpertProfileView: React.FC<ExpertProfileViewProps> = ({
  data,
  variant = "page",
  initialFilter = null,
  className,
}) => {
  const { teacher, courses, tests, liveTests, products } = data;
  const bundles = data.bundles ?? [];
  const organization = data.organization ?? null;
  const stats = useMemo(() => computeTeacherProfileStats(data), [data]);
  const displayName = teacher.displayName.trim();

  const catalogueRef = useRef<HTMLElement | null>(null);
  const aboutRef = useRef<HTMLElement | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const educator = {
    teacherName: displayName,
    teacherAvatarUrl: teacher.avatarUrl ?? null,
    teacherIsVerified: !!teacher.isVerified,
  };

  // A teacher's email, phone and personal website are not shown on the public
  // page; the website stays in their profile data and the admin panel. The
  // social links they chose to share are the only outbound routes offered here.

  // Enrolment, page and file counts are real data but are left off these
  // cards on purpose: only the rating (with reviews), a test count, a live
  // status or a bundle saving is shown, each only when it has a value.
  const courseCards = courses.map((course) => (
    <ExpertResourceCard
      key={`course-${course.id}`}
      {...educator}
      kind="course"
      to={`/course/${course.slug}`}
      title={course.title}
      examName={course.examName}
      rating={course.avgRating}
      ratingsCount={course.ratingsCount}
      price={itemPriceProps(course.price, course.discountPrice, course.couponOffer ?? null)}
      thumbnailUrl={course.thumbnailImageUrl}
      placeholderUrl={Placeholder.COURSE}
    />
  ));

  const testCards = tests.map((test) => (
    <ExpertResourceCard
      key={`test-${test.id}`}
      {...educator}
      kind="test"
      to={`/mock-test/${test.slug}`}
      title={test.title}
      examName={test.examName}
      rating={test.rating}
      ratingsCount={Number(test.reviewsCount ?? 0)}
      detail={test.totalTests ? `${test.totalTests} ${test.totalTests === 1 ? "test" : "tests"}` : null}
      price={itemPriceProps(test.price, test.discountPrice)}
      thumbnailUrl={test.thumbnailUrl}
      placeholderUrl={Placeholder.TEST}
    />
  ));

  const liveCards = liveTests.map((liveTest) => (
    <ExpertResourceCard
      key={`live-${liveTest.id}`}
      {...educator}
      kind="live"
      to={liveTestPath(liveTest.slug)}
      title={liveTest.title}
      examName={liveTest.examName}
      detail={formatLiveStatus(liveTest.status)}
      price={itemPriceProps(liveTest.price, liveTest.discountPrice)}
      thumbnailUrl={liveTest.thumbnailUrl}
      placeholderUrl={Placeholder.LIVE}
    />
  ));

  // Study notes carry no thumbnail, by product decision.
  const productCards = products.map((product) => (
    <ExpertResourceCard
      key={`product-${product.id}`}
      {...educator}
      kind="notes"
      to={`/study-notes/${product.slug}`}
      title={product.title}
      examName={product.examName}
      rating={product.rating}
      ratingsCount={product.ratingsCount}
      price={itemPriceProps(product.price, product.discountPrice)}
    />
  ));

  const bundleCards = bundles.map((bundle) => (
    <ExpertResourceCard
      key={`bundle-${bundle.id}`}
      {...educator}
      kind="bundle"
      to={`/bundles/${bundle.slug}`}
      title={bundle.title}
      savePercent={bundleSavePercent(bundle.price, bundle.originalPrice)}
      price={bundlePriceProps(bundle.price, bundle.originalPrice)}
      thumbnailUrl={bundle.thumbnailUrl}
      placeholderUrl={Placeholder.COURSE}
    />
  ));

  // Fixed order; an empty category is left out rather than shown empty.
  const groups = (
    [
      { key: "courses", cards: courseCards },
      { key: "tests", cards: testCards },
      { key: "live", cards: liveCards },
      { key: "products", cards: productCards },
      { key: "bundles", cards: bundleCards },
    ] as { key: CatalogueFilter; cards: React.ReactNode[] }[]
  ).filter((group) => group.cards.length > 0);

  const hasResources = groups.length > 0;

  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(() =>
    initialFilter && groups.some((group) => group.key === initialFilter) ? initialFilter : "all"
  );
  const visibleGroups = activeFilter === "all" ? groups : groups.filter((group) => group.key === activeFilter);

  useEffect(() => {
    if (initialFilter) catalogueRef.current?.scrollIntoView({ block: "start" });
    // Only on first load - a ?tab= link opens on its category once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectFilter = (filter: ActiveFilter) => {
    setActiveFilter(filter);
    smoothScroll(catalogueRef.current);
  };

  // Only platforms with a usable link get an icon: placeholders like "no" or
  // "NA" and plain names are dropped, scheme-less links get https://.
  const SOCIAL_PLATFORMS: { key: SocialPlatform; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
    { key: "youtube", label: "YouTube", Icon: FaYoutube },
    { key: "instagram", label: "Instagram", Icon: FaInstagram },
    { key: "linkedin", label: "LinkedIn", Icon: FaLinkedin },
    { key: "twitter", label: "X", Icon: FaXTwitter },
    { key: "telegram", label: "Telegram", Icon: FaTelegram },
    { key: "facebook", label: "Facebook", Icon: FaFacebook },
  ];
  const socialLinks = SOCIAL_PLATFORMS.flatMap(({ key, label, Icon }) => {
    const href = normalizeSocialUrl(key, teacher.socialLinks?.[key]);
    return href ? [{ key, href, label, Icon }] : [];
  });

  const joined = formatJoined(teacher.joinedAt);
  const languages = teacher.languages?.filter(Boolean) ?? [];
  const orgName = organization?.name ?? teacher.academyName ?? null;
  const followerCount = data.followerCount ?? 0;

  // A one or two word display name is a person, so headings can use the first
  // name. A titled name keeps the title with the surname ("Dr. Goyal").
  // Anything longer is usually an academy ("Deep's Physics Classes"), where
  // dropping the rest reads as a typo - those keep the full name.
  const nameParts = displayName.split(/\s+/);
  const hasTitle = /^(dr|prof|mr|mrs|ms|er)\.?$/i.test(nameParts[0] ?? "");
  const shortName =
    hasTitle && nameParts.length >= 2 && nameParts.length <= 3
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      : nameParts.length <= 2 && nameParts[0].length >= 3
        ? nameParts[0]
        : displayName;

  const expertise = Array.from(
    new Set(
      [
        ...(teacher.expertiseAreas ?? []).map((area) => (typeof area === "string" ? area : area.examName)),
        ...stats.exams,
      ]
        .filter((name): name is string => typeof name === "string" && name.trim().length > 0 && name !== "Unspecified")
        .map((name) => name.trim())
    )
  ).slice(0, 16);

  // Profile-level figures, each shown only when it has real data behind it: no
  // zeros, no placeholder rating, no filler metric. The rating needs actual
  // reviews (stats only averages items that have them).
  type HeadlineStat = {
    key: string;
    Icon: typeof Users;
    tone: "statLavender" | "statButter" | "statPowder";
    value: string;
    label: string;
    rating?: boolean;
  };
  const headlineStats = [
    variant === "page" &&
      followerCount > 0 && {
        key: "followers",
        Icon: Users,
        tone: "statLavender",
        value: formatStatCount(followerCount),
        label: followerCount === 1 ? "follower" : "followers",
      },
    stats.rating !== null &&
      stats.reviews > 0 && {
        key: "rating",
        Icon: MessageSquare,
        tone: "statButter",
        value: stats.rating.toFixed(1),
        label: `${formatStatCount(stats.reviews)} ${stats.reviews === 1 ? "review" : "reviews"}`,
        rating: true,
      },
    stats.yearsTeaching !== null &&
      stats.yearsTeaching > 0 && {
        key: "years",
        Icon: Briefcase,
        tone: "statPowder",
        value: `${stats.yearsTeaching}+`,
        label: stats.yearsTeaching === 1 ? "year teaching" : "years teaching",
      },
  ].filter(Boolean) as HeadlineStat[];

  const { intro, approach } = splitBio(teacher.bio);
  const { education, achievements } = splitAwards(teacher.awardsCertificates ?? []);
  const workExperiences = teacher.workExperiences ?? [];

  const details = [
    orgName && {
      key: "org",
      Icon: Building2,
      label: "Organization",
      value: organization ? (
        <Link to={getOrganizationProfilePath(organization.orgType, organization.slug)} className={styles.detailLink}>
          {organization.name}
        </Link>
      ) : (
        orgName
      ),
    },
    teacher.location && { key: "location", Icon: MapPin, label: "Location", value: teacher.location },
    languages.length > 0 && { key: "languages", Icon: Languages, label: "Languages", value: languages.join(", ") },
    stats.yearsTeaching !== null &&
      stats.yearsTeaching > 0 && {
        key: "experience",
        Icon: Award,
        label: "Teaching experience",
        value: `${stats.yearsTeaching}+ ${stats.yearsTeaching === 1 ? "year" : "years"}`,
      },
    joined && { key: "joined", Icon: CalendarDays, label: "Joined Testkart", value: joined },
    teacher.responseTime && { key: "response", Icon: Clock, label: "Response time", value: teacher.responseTime },
  ].filter(Boolean) as { key: string; Icon: typeof MapPin; label: string; value: React.ReactNode }[];

  const hasExperience = workExperiences.length > 0 || education.length > 0 || achievements.length > 0;
  const hasAbout =
    intro.length > 0 || approach.length > 0 || expertise.length > 0 || hasExperience || details.length > 0;

  return (
    <div className={`${styles.root} ${variant === "preview" ? styles.preview : ""} ${className || ""}`}>
      <section className={styles.hero}>
        <div className={styles.profileCard}>
          {teacher.slug && (
            <button
              type="button"
              className={styles.shareButton}
              onClick={() => setShareOpen(true)}
              aria-label="Share profile"
              title="Share profile"
            >
              <Share2 size={16} aria-hidden="true" />
              <span className={styles.shareLabel}>Share</span>
            </button>
          )}

          <div className={styles.profileBody}>
            {/* Decoration only: a few solid pastel shapes in the open right
                side on wide screens, as on the blog article header. */}
            <div className={styles.decor} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div className={styles.avatar}>
              {teacher.avatarUrl ? (
                <img src={teacher.avatarUrl} alt={displayName} className={styles.avatarImage} />
              ) : (
                <span className={styles.avatarFallback} aria-hidden="true">
                  {initialsOf(displayName)}
                </span>
              )}
            </div>

            <div className={styles.identity}>
              <div className={styles.heading}>
                {/* Inline, not flex: the tick follows the last word wherever it wraps. */}
                <h1 className={styles.name}>
                  {displayName}
                  <VerifiedBadge isVerified={!!teacher.isVerified} size="md" className={styles.nameBadge} />
                </h1>

                <p className={styles.orgLine}>
                  {organization ? (
                    <>
                      Educator at{" "}
                      <Link to={getOrganizationProfilePath(organization.orgType, organization.slug)} className={styles.orgLink}>
                        {organization.name}
                      </Link>
                    </>
                  ) : teacher.academyName ? (
                    <>
                      Educator at <strong>{teacher.academyName}</strong>
                    </>
                  ) : (
                    "Educator on Testkart"
                  )}
                </p>
              </div>

              {teacher.tagline && <p className={styles.tagline}>{teacher.tagline}</p>}

              <ul className={styles.meta}>
                {teacher.location && (
                  <li>
                    <MapPin size={15} aria-hidden="true" />
                    {teacher.location}
                  </li>
                )}
                {languages.length > 0 && (
                  <li>
                    <Languages size={15} aria-hidden="true" />
                    {languages.join(", ")}
                  </li>
                )}
                {joined && (
                  <li>
                    <CalendarDays size={15} aria-hidden="true" />
                    Joined {joined}
                  </li>
                )}
              </ul>

              {socialLinks.length > 0 && (
                <div className={styles.links}>
                  {socialLinks.map(({ key, href, label, Icon }) => (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${displayName} on ${label}`}
                      title={label}
                      className={styles.socialLink}
                    >
                      <Icon size={15} />
                    </a>
                  ))}
                </div>
              )}

              <div className={styles.actions}>
                {hasResources && (
                  <Button size="md" className={styles.actionPrimary} onClick={() => selectFilter("all")}>
                    Explore resources
                  </Button>
                )}
                {hasAbout && (
                  <button type="button" className={styles.actionSecondary} onClick={() => smoothScroll(aboutRef.current)}>
                    About {shortName}
                  </button>
                )}
                {variant === "page" && teacher.slug && (
                  <FollowTeacherButton
                    teacherId={teacher.id}
                    teacherSlug={teacher.slug}
                    isFollowing={!!data.isFollowing}
                    className={styles.followButton}
                  />
                )}
              </div>
            </div>
          </div>

          {headlineStats.length > 0 && (
            <div className={styles.statsBar}>
              <dl className={styles.stats}>
                {headlineStats.map(({ key, Icon, tone, value, label, rating }) => (
                  <div key={key} className={styles.stat}>
                    <span className={`${styles.statIcon} ${styles[tone]}`} aria-hidden="true">
                      <Icon size={14} />
                    </span>
                    <dt className={styles.srOnly}>{rating ? "Average rating" : label}</dt>
                    <dd className={styles.statBody}>
                      <span className={styles.statValue}>{value}</span>
                      {rating ? (
                        <>
                          <Star size={13} aria-label="out of 5 stars" className={styles.statStar} />
                          <span className={styles.statLabel}>· {label}</span>
                        </>
                      ) : (
                        <span className={styles.statLabel}>{label}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </section>

      <section className={styles.section} ref={catalogueRef} id="resources">
        <h2 className={styles.sectionTitle}>Learn with {shortName}</h2>

        {groups.length > 1 && (
          <div className={styles.filters} role="group" aria-label="Resource categories">
            <button
              type="button"
              className={`${styles.filter} ${activeFilter === "all" ? styles.filterActive : ""}`}
              aria-pressed={activeFilter === "all"}
              onClick={() => selectFilter("all")}
            >
              All
            </button>
            {groups.map(({ key }) => (
              <button
                key={key}
                type="button"
                className={`${styles.filter} ${activeFilter === key ? styles.filterActive : ""}`}
                aria-pressed={activeFilter === key}
                onClick={() => selectFilter(key)}
              >
                {GROUP_LABELS[key]}
              </button>
            ))}
          </div>
        )}

        {hasResources ? (
          <div className={styles.catalogue}>
            {visibleGroups.map(({ key, cards }) => (
              <CatalogueGroup
                key={key}
                id={key}
                title={GROUP_LABELS[key]}
                cards={cards}
                expanded={activeFilter === key || groups.length === 1}
                onViewAll={() => selectFilter(key)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyPanel}>
            <ShoppingBag size={22} aria-hidden="true" className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>Nothing published here yet</h3>
            <p className={styles.emptyText}>
              {shortName} is still building this catalogue. Follow to hear when new material goes live.
            </p>
          </div>
        )}
      </section>

      {hasAbout && (
      <section className={styles.section} ref={aboutRef} id="about">
        <h2 className={`${styles.sectionTitle} ${styles.aboutTitle}`}>About {shortName}</h2>

        <div className={styles.aboutGrid}>
          <div className={styles.aboutMain}>
            {intro.length > 0 && (
              <div className={styles.aboutBlock}>
                <h3 className={styles.blockTitle}>
                  <span className={`${styles.blockIcon} ${styles.toneMint}`} aria-hidden="true">
                    <UserRound size={15} />
                  </span>
                  Professional introduction
                </h3>
                <div className={`${styles.prose} ${styles.introProse}`}>
                  {intro.map((paragraph, i) => (
                    <BioParagraph key={i} text={paragraph} />
                  ))}
                </div>
              </div>
            )}

            {approach.length > 0 && (
              <div className={styles.aboutBlock}>
                <h3 className={styles.blockTitle}>
                  <span className={`${styles.blockIcon} ${styles.toneButter}`} aria-hidden="true">
                    <Lightbulb size={15} />
                  </span>
                  Teaching approach
                </h3>
                <div className={`${styles.prose} ${styles.approachPanel}`}>
                  {approach.map((paragraph, i) => (
                    <BioParagraph key={i} text={paragraph} />
                  ))}
                </div>
              </div>
            )}

            {expertise.length > 0 && (
              <div className={styles.aboutBlock}>
                <h3 className={styles.blockTitle}>
                  <span className={`${styles.blockIcon} ${styles.toneLavender}`} aria-hidden="true">
                    <BookOpen size={15} />
                  </span>
                  Subjects & exams
                </h3>
                <ul className={styles.tags}>
                  {expertise.map((name, i) => (
                    <li key={name} className={`${styles.tag} ${styles[TAG_TONES[i % TAG_TONES.length]]}`}>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasExperience && (
              <div className={styles.aboutBlock}>
                <h3 className={styles.blockTitle}>
                  <span className={`${styles.blockIcon} ${styles.tonePowder}`} aria-hidden="true">
                    <Award size={15} />
                  </span>
                  Experience & achievements
                </h3>

                {workExperiences.length > 0 && (
                  <div className={styles.subBlock}>
                    <h4 className={styles.subTitle}>Work</h4>
                    <ol className={styles.timeline}>
                      {workExperiences.map((entry) => (
                        <li
                          key={entry.id}
                          className={`${styles.timelineItem} ${entry.isCurrent ? styles.timelineCurrent : ""}`}
                        >
                          <span className={styles.timelineDot} aria-hidden="true" />
                          <p className={styles.timelineDate}>
                            {formatCalendarMonthYear(entry.startDate)} -{" "}
                            {entry.isCurrent ? "Present" : formatCalendarMonthYear(entry.endDate)}
                          </p>
                          <p className={styles.timelineRole}>{entry.position}</p>
                          <p className={styles.timelineOrg}>
                            {entry.companyName}
                            {entry.location ? <span className={styles.timelineLocation}> · {entry.location}</span> : null}
                          </p>
                          {entry.description && <p className={styles.timelineDesc}>{entry.description}</p>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {education.length > 0 && (
                  <div className={styles.subBlock}>
                    <h4 className={styles.subTitle}>Education & qualifications</h4>
                    <ul className={styles.rowList}>
                      {education.map((item, index) => (
                        <li key={`${item.title}-${index}`} className={styles.row}>
                          <span className={`${styles.rowIcon} ${styles.toneMint}`} aria-hidden="true">
                            <GraduationCap size={15} />
                          </span>
                          <div>
                            <p className={styles.rowTitle}>{item.title}</p>
                            {item.description && <p className={styles.rowDesc}>{item.description}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {achievements.length > 0 && (
                  <div className={styles.subBlock}>
                    <h4 className={styles.subTitle}>Achievements</h4>
                    <ul className={`${styles.rowList} ${styles.rowListColumns}`}>
                      {achievements.map((award, index) => (
                        <li key={`${award.title}-${index}`} className={styles.row}>
                          <span className={`${styles.rowIcon} ${styles.toneButter}`} aria-hidden="true">
                            <Trophy size={15} />
                          </span>
                          <div>
                            <p className={styles.rowTitle}>{award.title}</p>
                            {award.description && <p className={styles.rowDesc}>{award.description}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {details.length > 0 && (
            <aside className={styles.detailsPanel} aria-label="Expert details">
              <h3 className={styles.panelTitle}>Expert details</h3>
              <dl className={styles.detailList}>
                {details.map(({ key, Icon, label, value }, i) => (
                  <div key={key} className={styles.detailRow}>
                    <span
                      className={`${styles.detailIcon} ${styles[DETAIL_TONES[i % DETAIL_TONES.length]]}`}
                      aria-hidden="true"
                    >
                      <Icon size={15} />
                    </span>
                    <div className={styles.detailBody}>
                      <dt className={styles.detailLabel}>{label}</dt>
                      <dd className={styles.detailValue}>{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </aside>
          )}
        </div>
      </section>
      )}

      {variant === "page" && teacher.slug && <TeacherPostsSection teacherSlug={teacher.slug} shortName={shortName} />}

      {/* The standard teacher CTA that closes the asset detail pages, at page
          width. Signed-out only: a visitor with an account is not the audience
          for this ask on someone else's profile, which also keeps it out of the
          dashboard preview. */}
      <TeacherCtaBanner guestsOnly className={styles.teacherCta} />

      {teacher.slug && (
        <ShareAssetDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          kind="expert"
          handle={teacher.slug}
          title={displayName}
          campaign={EXPERT_PROFILE_SHARE_CAMPAIGN}
          heading="Share this profile"
          message={`Check out ${displayName} on Testkart`}
        />
      )}
    </div>
  );
};
