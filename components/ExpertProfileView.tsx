import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BookOpen,
  Briefcase,
  ClipboardList,
  Compass,
  Eye,
  GraduationCap,
  Globe,
  Link as LinkIcon,
  MapPin,
  MessageSquare,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import type { OutputType } from "../endpoints/teachers/profile_GET.schema";
import { computeTeacherProfileStats, formatStatCount } from "../helpers/teacherProfileStats";
import { formatItemPrice } from "../helpers/homepageItemUtils";
import { Placeholder } from "../helpers/placeholderImages";
import { EXPERT_PROFILE_SHARE_CAMPAIGN } from "../helpers/shareLinks";
import { TeacherProductCard } from "./HomepageContentSection";
import { ShareAssetDialog } from "./ShareAssetDialog";
import { VerifiedBadge } from "./VerifiedBadge";
import { TeacherCtaBanner } from "./TeacherCtaBanner";
import styles from "./ExpertProfileView.module.css";

type CatalogueFilter = "courses" | "tests" | "live" | "products";

/** One row of cards, then a View more button. */
const ROWS_PER_STEP = 2;

interface ExpertProfileViewProps {
  data: OutputType;
  /**
   * "preview" is the same page rendered inside the teacher's own dashboard,
   * so it drops a size step and never claims the full viewport height.
   */
  variant?: "page" | "preview";
  initialFilter?: CatalogueFilter | null;
  className?: string;
}

const FILTER_LABELS: Record<CatalogueFilter, string> = {
  courses: "Courses",
  tests: "Test series",
  live: "Live tests",
  products: "Notes & PDFs",
};

const LEARNING_STEPS = [
  {
    icon: Compass,
    title: "Pick what you need",
    text: "Full test series, a course, a live exam or a set of notes - each one built for a specific exam.",
  },
  {
    icon: Target,
    title: "Practise the real thing",
    text: "Exam-pattern papers with timers, detailed solutions and question-level explanations.",
  },
  {
    icon: TrendingUp,
    title: "See where you stand",
    text: "Scores, accuracy and All India rank after every attempt, so you know what to fix next.",
  },
];

const formatMonthYear = (value: Date | string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(date);
};

const formatYear = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return String(date.getFullYear());
};

export const ExpertProfileView: React.FC<ExpertProfileViewProps> = ({
  data,
  variant = "page",
  initialFilter = null,
  className,
}) => {
  const { teacher, courses, tests, liveTests, products } = data;
  const stats = useMemo(() => computeTeacherProfileStats(data), [data]);

  const catalogueRef = useRef<HTMLElement | null>(null);
  const aboutRef = useRef<HTMLElement | null>(null);

  const availableFilters = useMemo(() => {
    const filters: { value: CatalogueFilter; count: number }[] = [
      { value: "tests", count: stats.tests },
      { value: "courses", count: stats.courses },
      { value: "live", count: stats.liveTests },
      { value: "products", count: stats.products },
    ];
    return filters.filter((filter) => filter.count > 0);
  }, [stats]);

  // Resolved rather than stored, so a teacher who publishes their first course
  // does not have to be re-defaulted by an effect.
  const [filter, setFilter] = useState<CatalogueFilter | null>(initialFilter ?? null);
  const activeFilter =
    filter && availableFilters.some((item) => item.value === filter)
      ? filter
      : availableFilters[0]?.value ?? null;

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(4);
  const [rowsShown, setRowsShown] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);

  const teacherCardProps = {
    teacherName: teacher.displayName,
    teacherAvatarUrl: teacher.avatarUrl ?? null,
    teacherTagline: teacher.tagline ?? null,
    teacherYearsOfExperience: teacher.yearsOfExperience ?? null,
    teacherSlug: teacher.slug ?? null,
    teacherIsVerified: !!teacher.isVerified,
  };

  const scrollTo = (target: React.MutableRefObject<HTMLElement | null>) => {
    target.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // A teacher's email and phone are never surfaced on the public page - not as
  // text, not as a mailto:/tel: href. The website is the only outbound contact
  // route offered here; everything else goes through Testkart.
  const contactHref = teacher.websiteUrl
    ? teacher.websiteUrl.match(/^https?:\/\//)
      ? teacher.websiteUrl
      : `https://${teacher.websiteUrl}`
    : null;

  const expertiseAreas = (teacher.expertiseAreas ?? [])
    .map((area) => (typeof area === "string" ? area : area.examName))
    .filter((area) => !!area && area.trim().length > 0);

  // What the teacher has published leads, then the volume of work behind it,
  // then the audience it reached. Exams covered and years teaching sit last as
  // fallbacks - they only reach the visible five when a profile is sparse.
  // Labels are one word wherever the number already carries the meaning: five
  // of these sit two-up on a phone, and a two-word label wrapped every cell.
  const headlineStats = [
    stats.catalogue > 0 && {
      key: "catalogue",
      icon: BookOpen,
      value: formatStatCount(stats.catalogue),
      label: "Resources",
    },
    stats.questions > 0 && {
      key: "questions",
      icon: ClipboardList,
      value: formatStatCount(stats.questions),
      label: "Questions",
    },
    stats.students > 0 && {
      key: "students",
      icon: Users,
      value: formatStatCount(stats.students),
      label: "Students",
    },
    stats.views > 0 && {
      key: "views",
      icon: Eye,
      value: formatStatCount(stats.views),
      label: "Views",
    },
    stats.rating !== null && {
      key: "rating",
      icon: Star,
      value: stats.rating.toFixed(1),
      // The review count is the one label that still earns a second word - a
      // bare "Rating" under 4.9 says nothing about how much it is worth.
      label: `${formatStatCount(stats.reviews)} reviews`,
    },
    stats.exams.length > 0 && {
      key: "exams",
      icon: Target,
      value: String(stats.exams.length),
      label: stats.exams.length === 1 ? "Exam" : "Exams",
    },
    stats.yearsTeaching !== null && {
      key: "years",
      icon: Briefcase,
      value: `${stats.yearsTeaching}+`,
      label: "Years",
    },
  ].filter(Boolean) as { key: string; icon: typeof Users; value: string; label: string }[];

  const visibleStats = headlineStats.slice(0, 5);

  const courseCards = courses.map((course) => (
    <TeacherProductCard
      key={`course-${course.id}`}
      {...teacherCardProps}
      link={`/course/${course.slug}`}
      productTitle={course.title}
      examName={course.examName}
      stats={`${(course.views ?? 0).toLocaleString("en-IN")} views`}
      priceLabel={formatItemPrice(course.price)}
      isFree={course.price === 0}
      thumbnailUrl={course.thumbnailImageUrl}
      placeholderUrl={Placeholder.COURSE}
    />
  ));

  const testCards = tests.map((test) => (
    <TeacherProductCard
      key={`test-${test.id}`}
      {...teacherCardProps}
      link={`/mock-test/${test.slug}`}
      productTitle={test.title}
      examName={test.examName}
      stats={`${(test.views ?? 0).toLocaleString("en-IN")} views${
        test.rating != null ? ` · ${test.rating.toFixed(1)} rating` : ""
      }`}
      priceLabel={formatItemPrice(test.price, test.discountPrice)}
      isFree={(test.discountPrice ?? test.price) === 0}
      thumbnailUrl={test.thumbnailUrl}
      placeholderUrl={Placeholder.TEST}
    />
  ));

  const liveCards = liveTests.map((liveTest) => (
    <TeacherProductCard
      key={`live-${liveTest.id}`}
      {...teacherCardProps}
      link={`/mock-test/live/${liveTest.id}`}
      productTitle={liveTest.title}
      examName={liveTest.examName}
      stats={`${liveTest.enrolledCount.toLocaleString("en-IN")} enrolled · ${liveTest.status.replace(/_/g, " ")}`}
      priceLabel={formatItemPrice(liveTest.price)}
      isFree={liveTest.price === 0}
      thumbnailUrl={liveTest.thumbnailUrl}
      placeholderUrl={Placeholder.LIVE}
    />
  ));

  const productCards = products.map((product) => (
    <TeacherProductCard
      key={`product-${product.id}`}
      {...teacherCardProps}
      link={`/study-notes/${product.slug}`}
      productTitle={product.title}
      examName={product.examName}
      stats={[
        `${(product.views ?? 0).toLocaleString("en-IN")} views`,
        product.pageCount ? `${product.pageCount} pages` : null,
        product.fileCount > 1 ? `${product.fileCount} files` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      priceLabel={formatItemPrice(product.price)}
      isFree={product.price === 0}
    />
  ));

  const visibleCards =
    activeFilter === "courses"
      ? courseCards
      : activeFilter === "tests"
        ? testCards
        : activeFilter === "live"
          ? liveCards
          : activeFilter === "products"
            ? productCards
            : [];

  // The grid is auto-fill, so the column count is whatever the current width
  // resolves to - read it off the resolved template rather than guessing from
  // a breakpoint, so "one row" means one row at every size.
  const hasCards = visibleCards.length > 0;
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const template = window.getComputedStyle(grid).gridTemplateColumns;
      const count = template.split(" ").filter(Boolean).length;
      if (count > 0) setColumns(count);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [hasCards]);

  const shownCards = visibleCards.slice(0, columns * rowsShown);
  const hiddenCount = visibleCards.length - shownCards.length;

  const socialLinks = [
    teacher.socialLinks?.youtube && { key: "youtube", href: teacher.socialLinks.youtube, label: "YouTube", Icon: FaYoutube },
    teacher.socialLinks?.linkedin && { key: "linkedin", href: teacher.socialLinks.linkedin, label: "LinkedIn", Icon: FaLinkedin },
    teacher.socialLinks?.twitter && { key: "twitter", href: teacher.socialLinks.twitter, label: "X", Icon: FaXTwitter },
    teacher.socialLinks?.instagram && { key: "instagram", href: teacher.socialLinks.instagram, label: "Instagram", Icon: FaInstagram },
    teacher.socialLinks?.facebook && { key: "facebook", href: teacher.socialLinks.facebook, label: "Facebook", Icon: FaFacebook },
  ].filter(Boolean) as { key: string; href: string; label: string; Icon: React.ComponentType<{ size?: number }> }[];

  const joinedYear = formatYear(teacher.joinedAt);

  // A one or two word display name is a person, so headings can use the first
  // name. Anything longer is usually an academy ("Deep's Physics Classes"),
  // where dropping the rest reads as a typo - those keep the full name.
  const nameParts = teacher.displayName.trim().split(/\s+/);
  const shortName =
    nameParts.length <= 2 && nameParts[0].length >= 3 ? nameParts[0] : teacher.displayName.trim();
  const hasAbout =
    !!teacher.bio ||
    (teacher.workExperiences?.length ?? 0) > 0 ||
    (teacher.awardsCertificates?.length ?? 0) > 0;

  return (
    <div className={`${styles.root} ${variant === "preview" ? styles.preview : ""} ${className || ""}`}>
      <section className={styles.hero}>
        <span className={styles.heroPattern} aria-hidden="true" />
        <div className={styles.heroInner}>
          {teacher.slug && (
            <button
              type="button"
              className={styles.shareButton}
              onClick={() => setShareOpen(true)}
            >
              <Share2 size={16} aria-hidden="true" />
              Share
            </button>
          )}

          {/* Two badges, one shown at a time by the stylesheet: on a phone the
              tick rides the avatar's bottom right corner, everywhere else it
              follows the name. Rendering both beats moving one with JS - there
              is no width to read at first paint, so a measured swap would flash
              the wrong one. */}
          <div className={styles.heroAvatarBlock}>
            <div className={styles.heroAvatarWrap}>
              {teacher.avatarUrl ? (
                <img src={teacher.avatarUrl} alt={teacher.displayName} className={styles.heroAvatar} />
              ) : (
                <span className={styles.heroAvatarFallback} aria-hidden="true">
                  <User size={56} />
                </span>
              )}
            </div>
            <VerifiedBadge
              isVerified={!!teacher.isVerified}
              size="lg"
              className={styles.avatarBadge}
            />
          </div>

          <div className={styles.heroText}>
            <span className={styles.eyebrow}>
              <Sparkles size={14} aria-hidden="true" />
              {teacher.academyName ? teacher.academyName : "Educator on Testkart"}
            </span>

            <h1 className={styles.name}>
              {teacher.displayName}
              <VerifiedBadge isVerified={!!teacher.isVerified} size="lg" className={styles.nameBadge} />
            </h1>

            {teacher.tagline && <p className={styles.tagline}>{teacher.tagline}</p>}

            <ul className={styles.heroMeta}>
              {teacher.location && (
                <li className={styles.heroMetaItem}>
                  <MapPin size={15} aria-hidden="true" />
                  {teacher.location}
                </li>
              )}
              {teacher.languages && teacher.languages.length > 0 && (
                <li className={styles.heroMetaItem}>
                  <Globe size={15} aria-hidden="true" />
                  Teaches in {teacher.languages.join(", ")}
                </li>
              )}
              {teacher.responseTime && (
                <li className={styles.heroMetaItem}>
                  <MessageSquare size={15} aria-hidden="true" />
                  {/* Stored as a whole phrase ("Usually responds in a few
                      hours"), so it takes no label of its own. */}
                  {teacher.responseTime}
                </li>
              )}
              {joinedYear && (
                <li className={styles.heroMetaItem}>
                  <GraduationCap size={15} aria-hidden="true" />
                  On Testkart since {joinedYear}
                </li>
              )}
            </ul>

            <div className={styles.heroActions}>
              {stats.catalogue > 0 ? (
                <button type="button" className={styles.heroPrimary} onClick={() => scrollTo(catalogueRef)}>
                  Explore {formatStatCount(stats.catalogue)} {stats.catalogue === 1 ? "resource" : "resources"}
                </button>
              ) : (
                hasAbout && (
                  <button type="button" className={styles.heroPrimary} onClick={() => scrollTo(aboutRef)}>
                    About {shortName}
                  </button>
                )
              )}
              {contactHref ? (
                <a className={styles.heroSecondary} href={contactHref} target="_blank" rel="noreferrer">
                  Visit website
                </a>
              ) : (
                hasAbout &&
                stats.catalogue > 0 && (
                  <button type="button" className={styles.heroSecondary} onClick={() => scrollTo(aboutRef)}>
                    About {shortName}
                  </button>
                )
              )}
            </div>

            {socialLinks.length > 0 && (
              <div className={styles.socialRow}>
                {socialLinks.map(({ key, href, label, Icon }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className={styles.socialLink}
                  >
                    <Icon size={17} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {visibleStats.length > 0 && (
        <div className={styles.statsBand}>
          <dl className={styles.statsCard}>
            {visibleStats.map(({ key, icon: Icon, value, label }) => (
              <div key={key} className={styles.stat}>
                <span className={styles.statIcon} aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div className={styles.statBody}>
                  <dt className={styles.statValue}>{value}</dt>
                  <dd className={styles.statLabel}>{label}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(expertiseAreas.length > 0 || stats.exams.length > 0) && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>What {shortName} teaches</h2>
            <p className={styles.sectionText}>
              Subjects and exams covered by the material on this page.
            </p>
          </div>
          <div className={styles.chipCloud}>
            {expertiseAreas.map((area) => (
              <span key={`skill-${area}`} className={styles.chipSolid}>
                {area}
              </span>
            ))}
            {stats.exams.map((exam) => (
              <span key={`exam-${exam}`} className={styles.chip}>
                {exam}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section} ref={catalogueRef}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Learn with {shortName}</h2>
          <p className={styles.sectionText}>
            {stats.catalogue > 0
              ? `${formatStatCount(stats.catalogue)} published ${
                  stats.catalogue === 1 ? "resource" : "resources"
                }${stats.freeItems > 0 ? `, including ${stats.freeItems} free to start` : ""}.`
              : "Nothing published yet. New material will show up here as soon as it goes live."}
          </p>
        </div>

        {availableFilters.length > 1 && (
          <div className={styles.filters} role="tablist" aria-label="Filter published material">
            {availableFilters.map(({ value, count }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeFilter === value}
                className={`${styles.filter} ${activeFilter === value ? styles.filterActive : ""}`}
                onClick={() => {
                  setFilter(value);
                  setRowsShown(1);
                }}
              >
                {FILTER_LABELS[value]}
                <span className={styles.filterCount}>{count}</span>
              </button>
            ))}
          </div>
        )}

        {hasCards ? (
          <>
            <div className={styles.grid} ref={gridRef}>
              {shownCards}
            </div>
            {hiddenCount > 0 && (
              <div className={styles.loadMoreRow}>
                <button
                  type="button"
                  className={styles.loadMore}
                  onClick={() => setRowsShown((rows) => rows + ROWS_PER_STEP)}
                >
                  View more
                  <span className={styles.loadMoreCount}>{hiddenCount}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyPanel}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <ShoppingBag size={24} />
            </span>
            <h3 className={styles.emptyTitle}>Nothing published here yet</h3>
            <p className={styles.emptyText}>
              {shortName} is still building this catalogue. Follow the social links above to hear when it
              lands.
            </p>
          </div>
        )}
      </section>

      {stats.catalogue > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>How learning here works</h2>
          </div>
          <ol className={styles.steps}>
            {LEARNING_STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className={styles.step}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <span className={styles.stepIcon} aria-hidden="true">
                  <Icon size={20} />
                </span>
                <h3 className={styles.stepTitle}>{title}</h3>
                <p className={styles.stepText}>{text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className={styles.section} ref={aboutRef}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>About {shortName}</h2>
        </div>

        <div className={styles.aboutGrid}>
          <div className={styles.aboutMain}>
            {teacher.bio ? (
              <article className={styles.card}>
                <p className={styles.bio}>{teacher.bio}</p>
              </article>
            ) : (
              <article className={styles.card}>
                <p className={styles.mutedText}>
                  {shortName} has not written an introduction yet.
                </p>
              </article>
            )}

            {teacher.workExperiences && teacher.workExperiences.length > 0 && (
              <article className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <Briefcase size={17} aria-hidden="true" />
                  Experience
                </h3>
                <ul className={styles.timeline}>
                  {teacher.workExperiences.map((entry) => (
                    <li key={entry.id} className={styles.timelineItem}>
                      <span className={styles.timelineDot} aria-hidden="true" />
                      <h4 className={styles.timelineRole}>{entry.position}</h4>
                      <p className={styles.timelineMeta}>
                        {entry.companyName}
                        {entry.location ? ` · ${entry.location}` : ""}
                      </p>
                      <p className={styles.timelineDate}>
                        {formatMonthYear(entry.startDate)} -{" "}
                        {entry.isCurrent ? "Present" : formatMonthYear(entry.endDate)}
                      </p>
                      {entry.description && <p className={styles.timelineDesc}>{entry.description}</p>}
                    </li>
                  ))}
                </ul>
              </article>
            )}

            {teacher.awardsCertificates && teacher.awardsCertificates.length > 0 && (
              <article className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <Award size={17} aria-hidden="true" />
                  Awards & certificates
                </h3>
                <ul className={styles.awards}>
                  {teacher.awardsCertificates.map((award, index) => (
                    <li key={`${award.title}-${index}`} className={styles.award}>
                      <span className={styles.awardIcon} aria-hidden="true">
                        <Award size={18} />
                      </span>
                      <div>
                        <p className={styles.awardTitle}>{award.title}</p>
                        {award.description && <p className={styles.awardDesc}>{award.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            )}
          </div>

          <aside className={styles.aboutSide}>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>
                <User size={17} aria-hidden="true" />
                Details
              </h3>
              <ul className={styles.details}>
                {teacher.location && (
                  <li className={styles.detail}>
                    <MapPin size={16} aria-hidden="true" />
                    <span>{teacher.location}</span>
                  </li>
                )}
                {teacher.languages && teacher.languages.length > 0 && (
                  <li className={styles.detail}>
                    <Globe size={16} aria-hidden="true" />
                    <span>{teacher.languages.join(", ")}</span>
                  </li>
                )}
                {stats.yearsTeaching !== null && (
                  <li className={styles.detail}>
                    <Briefcase size={16} aria-hidden="true" />
                    <span>{stats.yearsTeaching}+ years teaching</span>
                  </li>
                )}
                {teacher.websiteUrl && (
                  <li className={styles.detail}>
                    <LinkIcon size={16} aria-hidden="true" />
                    <a
                      href={teacher.websiteUrl.match(/^https?:\/\//) ? teacher.websiteUrl : `https://${teacher.websiteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.detailLink}
                    >
                      {teacher.websiteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                )}
                {/* Views live in the headline stats band now, so this list
                    stays profile facts only - no figure repeated twice. */}
              </ul>
            </article>

          </aside>
        </div>
      </section>

      {stats.catalogue > 0 && (
        <section className={styles.closing}>
          <span className={styles.heroPattern} aria-hidden="true" />
          <div className={styles.closingInner}>
            <h2 className={styles.closingTitle}>Start preparing with {shortName}</h2>
            <p className={styles.closingText}>
              {stats.students > 0
                ? `${formatStatCount(stats.students)} students are already learning from this teacher.`
                : "Every paper, course and note on this page is built for one thing - your next exam."}
            </p>
            <button type="button" className={styles.heroPrimary} onClick={() => scrollTo(catalogueRef)}>
              Browse the catalogue
            </button>
          </div>
        </section>
      )}

      {/* The standard teacher CTA, the same component that closes the asset
          detail pages. It sits below the closing band so the student ask -
          "Start preparing with X" - is the last word on a student-facing page,
          and the "become a teacher" pitch reads as the footnote it is. It runs
          at page width so it gets the same two-column card as the bundles and
          study-notes pages - in a 376px sidebar it would have dropped to the
          phone layout and towered over a sparse profile. Signed-out only: a
          visitor who already has an account is not the audience for this ask on
          someone else's profile, and that also keeps it out of the dashboard
          preview. */}
      <TeacherCtaBanner guestsOnly className={styles.teacherCta} />

      {teacher.slug && (
        <ShareAssetDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          kind="expert"
          handle={teacher.slug}
          title={teacher.displayName}
          campaign={EXPERT_PROFILE_SHARE_CAMPAIGN}
          heading="Share this profile"
          message={`Check out ${teacher.displayName} on Testkart`}
        />
      )}
    </div>
  );
};
