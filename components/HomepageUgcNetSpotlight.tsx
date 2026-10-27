import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Languages,
  Layers,
  PenLine,
  PlayCircle,
  RotateCw,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { getTestsList, type TestListItem } from "../endpoints/tests/list_GET.schema";
import { getShopProductsList, type ShopProductListItem } from "../endpoints/shop/list_GET.schema";
import type { CourseListItem } from "../endpoints/courses/list_GET.schema";
import { getCoursesDetails } from "../endpoints/courses/details_GET.schema";
import { useTeacherPublicProfileQuery } from "../helpers/useTeacherPublicProfile";
import { useExamDetailQuery } from "../helpers/useExamDetail";
import { TESTS_QUERY_KEY } from "../helpers/useTestsQuery";
import { SHOP_PRODUCTS_QUERY_KEY } from "../helpers/useShopQuery";
import { PUBLIC_COURSE_DETAILS_QUERY_KEY } from "../helpers/useStudentCoursesQuery";
import { usePublicPromoCodesQuery } from "../helpers/usePublicPromoCodes";
import { bestPromoCode } from "../helpers/promoCodeDiscount";
import {
  UGC_NET_EXAM_SLUG,
  UGC_NET_FEATURED_TEACHER_SLUG,
  interleaveByTeacher,
  pickFeaturedCourse,
  ugcNetNotesFilters,
  ugcNetPaths,
  ugcNetTestsFilters,
} from "../helpers/ugcNetSpotlightQueries";
import { itemPriceProps, type ItemPriceProps } from "../helpers/homepageItemUtils";
import { courseDiscountPrice } from "../helpers/coursePricing";
import { Placeholder } from "../helpers/placeholderImages";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { Skeleton } from "./Skeleton";
import styles from "./HomepageUgcNetSpotlight.module.css";

const MAX_PER_TYPE = 7;

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// Some counts come back from SQL aggregates as strings, so coerce first.
const toCount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatCount = (value: unknown) => toCount(value).toLocaleString("en-IN");

/** Rupees, with paise only when there are any (a coupon can leave ₹1,599.20). */
const formatRupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);

function initials(name: string) {
  return name.replace(/^Dr\.?\s+/i, "").substring(0, 2).toUpperCase();
}

/* Resources: mock tests and study notes normalised into one card model. */

type ResourceMeta = { icon: LucideIcon; text: string };

type Resource = ItemPriceProps & {
  key: string;
  badge: string;
  /** Whether the badge also goes over a real thumbnail (notes yes, mock tests no). */
  badgeOnImage: boolean;
  icon: LucideIcon;
  title: string;
  link: string;
  teacherName: string;
  teacherAvatarUrl: string | null;
  teacherIsVerified: boolean;
  thumbnailUrl: string | null;
  meta: ResourceMeta[];
};

function testResource(test: TestListItem): Resource {
  // tests/list sets totalTests to the series' papers that have questions.
  const tests = toCount(test.totalTests);
  const languages = test.languages?.length ? test.languages.join(", ") : test.language;
  const meta: ResourceMeta[] = [];
  if (tests) meta.push({ icon: Layers, text: `${formatCount(tests)} ${tests === 1 ? "Test" : "Tests"}` });
  if (languages) meta.push({ icon: Languages, text: languages });
  return {
    key: `test-${test.id}`,
    badge: "Mock test",
    badgeOnImage: false,
    icon: ClipboardCheck,
    title: test.title.trim(),
    link: `/mock-test/${test.slug}`,
    teacherName: test.teacherName,
    teacherAvatarUrl: test.teacherAvatarUrl,
    teacherIsVerified: test.teacherIsVerified,
    thumbnailUrl: test.thumbnailUrl,
    meta,
    ...itemPriceProps(test.price, test.discountPrice),
  };
}

/** Badge and icon for a study note's free-text category. */
function noteKind(category: string | null): { badge: string; icon: LucideIcon } {
  const value = category?.trim() ?? "";
  if (/study material/i.test(value)) return { badge: "Study material", icon: BookOpen };
  if (/note/i.test(value)) return { badge: "Notes", icon: PenLine };
  return { badge: "PDF", icon: FileText };
}

function noteResource(note: ShopProductListItem): Resource {
  const kind = noteKind(note.category);
  const category = note.category?.trim();
  const pages = toCount(note.pageCount);
  const files = toCount(note.fileCount);
  const meta: ResourceMeta[] = [];
  if (kind.badge === "PDF" && category) meta.push({ icon: BookOpen, text: category });
  if (pages) meta.push({ icon: FileText, text: `${formatCount(pages)} ${pages === 1 ? "page" : "pages"}` });
  if (files > 1) meta.push({ icon: Layers, text: `${files} files` });
  return {
    key: `note-${note.id}`,
    badge: kind.badge,
    badgeOnImage: true,
    icon: kind.icon,
    title: note.title.trim(),
    link: `/study-notes/${note.slug}`,
    teacherName: note.teacherName,
    teacherAvatarUrl: note.teacherAvatar,
    teacherIsVerified: note.teacherIsVerified,
    thumbnailUrl: note.thumbnailUrl,
    meta,
    ...itemPriceProps(note.price),
  };
}

/**
 * Verified teachers' items first, each group spread across its teachers, so
 * a popular unverified teacher cannot push verified ones out of the cut.
 */
function verifiedFirstByTeacher<T extends { teacherIsVerified: boolean }>(
  items: T[],
  teacherKey: (item: T) => string,
): T[] {
  return [
    ...interleaveByTeacher(items.filter((item) => item.teacherIsVerified), teacherKey),
    ...interleaveByTeacher(items.filter((item) => !item.teacherIsVerified), teacherKey),
  ];
}

/**
 * Alternates the two lists (test, note, test, ...), drops any repeat, then
 * moves verified teachers' items ahead of the rest, keeping the alternation
 * inside each group.
 */
function mixResources(tests: Resource[], notes: Resource[]): Resource[] {
  const seen = new Set<string>();
  const mixed: Resource[] = [];
  for (let i = 0; i < Math.max(tests.length, notes.length); i++) {
    for (const item of [tests[i], notes[i]]) {
      if (item && !seen.has(item.key)) {
        seen.add(item.key);
        mixed.push(item);
      }
    }
  }
  return [...mixed.filter((item) => item.teacherIsVerified), ...mixed.filter((item) => !item.teacherIsVerified)];
}

/**
 * Compact UGC NET hub on the homepage: a header, one featured course from Dr.
 * Mukesh Goyal (his public profile) with its real discount when it has one,
 * and a single carousel mixing the most popular UGC NET mock tests and study
 * notes from every teacher (tests/list and shop/list filtered to the UGC NET
 * exam, each spread across teachers, then alternated, verified teachers
 * first). All of it, including
 * the featured course's details, is prefetched in pages/_index.prefetch.ts
 * with the keys in helpers/ugcNetSpotlightQueries. The featured card and the
 * carousel each have their own loading, empty and error state; the section
 * hides only when both are settled and empty.
 */
export function HomepageUgcNetSpotlight() {
  const examQuery = useExamDetailQuery(UGC_NET_EXAM_SLUG);
  const examId = examQuery.data?.id;

  const profileQuery = useTeacherPublicProfileQuery(UGC_NET_FEATURED_TEACHER_SLUG);

  const testsFilters = examId ? ugcNetTestsFilters(examId) : null;
  const testsQuery = useQuery({
    queryKey: [...TESTS_QUERY_KEY, testsFilters],
    queryFn: () => getTestsList(testsFilters!),
    enabled: testsFilters !== null,
    staleTime: 10 * 60 * 1000,
  });

  const notesFilters = examId ? ugcNetNotesFilters(examId) : null;
  const notesQuery = useQuery({
    queryKey: [...SHOP_PRODUCTS_QUERY_KEY, notesFilters],
    queryFn: () => getShopProductsList(notesFilters!),
    enabled: notesFilters !== null,
    staleTime: 10 * 60 * 1000,
  });

  const featured = useMemo(() => pickFeaturedCourse(profileQuery.data?.courses), [profileQuery.data]);

  const resources = useMemo(() => {
    const tests = verifiedFirstByTeacher(testsQuery.data?.tests ?? [], (t) => t.teacherSlug ?? t.teacherName)
      .slice(0, MAX_PER_TYPE)
      .map(testResource);
    const notes = verifiedFirstByTeacher(notesQuery.data?.products ?? [], (n) => n.teacherSlug)
      .slice(0, MAX_PER_TYPE)
      .map(noteResource);
    return mixResources(tests, notes);
  }, [testsQuery.data, notesQuery.data]);

  const examMissing = examQuery.isSuccess && !examQuery.data;
  const resourcesLoading =
    examQuery.isPending || (!!examId && testsQuery.isPending && notesQuery.isPending);
  const resourcesFailed =
    examQuery.isError || (!!examId && testsQuery.isError && notesQuery.isError);
  const retryResources = () => {
    if (examQuery.isError) return void examQuery.refetch();
    if (testsQuery.isError) void testsQuery.refetch();
    if (notesQuery.isError) void notesQuery.refetch();
  };

  const featuredLoading = profileQuery.isPending;
  const featuredSettledEmpty = !featuredLoading && !featured && !profileQuery.isError;

  if (
    featuredSettledEmpty &&
    !resourcesLoading &&
    !resourcesFailed &&
    (examMissing || resources.length === 0)
  ) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="ugc-net-spotlight-title">
      <div className={styles.block}>
        <span className={styles.blobMint} aria-hidden />
        <span className={styles.blobLavender} aria-hidden />

        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h2 id="ugc-net-spotlight-title" className={styles.title}>
              UGC NET <span className={styles.titleAccent}>Spotlight</span>
            </h2>
            <svg className={styles.titleUnderline} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden>
              <path d="M2 6.5C20 2.5 38 8.5 58 5S98 2 118 5.5" />
            </svg>
            <p className={styles.subtitle}>Everything you need for your UGC NET preparation.</p>
          </div>
          <SpotlightIllustration />
        </header>

        {featuredLoading ? (
          <FeaturedCourseSkeleton />
        ) : featured ? (
          <FeaturedCourseCard course={featured} />
        ) : profileQuery.isError ? (
          <Message
            tone="error"
            message="We could not load the featured course."
            onRetry={() => profileQuery.refetch()}
          />
        ) : null}

        <ResourcesCarousel
          resources={resources}
          isLoading={resourcesLoading}
          isError={resourcesFailed}
          onRetry={retryResources}
        />
      </div>
    </section>
  );
}

function SpotlightIllustration() {
  return (
    <svg className={styles.illustration} viewBox="0 0 132 96" aria-hidden>
      <path className={styles.illoShadow} d="M18 86h96" />
      <rect className={styles.illoBookPeach} x="24" y="66" width="80" height="16" rx="4" />
      <path className={styles.illoPage} d="M98 70v8" />
      <rect className={styles.illoBookMint} x="30" y="52" width="70" height="14" rx="4" />
      <path className={styles.illoPage} d="M94 56v6" />
      <rect className={styles.illoBookLavender} x="20" y="38" width="76" height="14" rx="4" />
      <path className={styles.illoPage} d="M90 42v6" />
      <path className={styles.illoCap} d="M58 12 86 24 58 36 30 24Z" />
      <path className={styles.illoCapBase} d="M44 30v6c0 3 6.5 6 14 6s14-3 14-6v-6l-14 6Z" />
      <path className={styles.illoTassel} d="M86 24v12" />
      <circle className={styles.illoTasselEnd} cx="86" cy="38" r="2.5" />
      <path
        className={styles.illoSparkle}
        d="M112 10c.6 4 1.6 5 5.6 5.6-4 .6-5 1.6-5.6 5.6-.6-4-1.6-5-5.6-5.6 4-.6 5-1.6 5.6-5.6Z"
      />
      <path
        className={styles.illoSparkleSmall}
        d="M14 22c.4 2.6 1 3.2 3.6 3.6-2.6.4-3.2 1-3.6 3.6-.4-2.6-1-3.2-3.6-3.6 2.6-.4 3.2-1 3.6-3.6Z"
      />
      <circle className={styles.illoDot} cx="118" cy="56" r="3" />
      <path className={styles.illoSquiggle} d="M104 34c3-3 6 3 9 0s6 3 9 0" />
    </svg>
  );
}

/* Featured course: teacher, title, then language / level / lessons pills, with
   an e-commerce style price breakdown on the right. Lessons and pricing come
   from the course page's own details query (same key, so the cache is
   shared), falling back to the profile's list values until it loads. The
   course's own discount counts only when courseDiscountPrice accepts it. On
   top of that, the public coupon that takes the most off (the coupons the
   course page lists, same query) is applied with promoDiscountFor, which
   mirrors checkout, and its code is shown so the student can use it. */

function FeaturedCourseCard({ course }: { course: CourseListItem }) {
  const detailsQuery = useQuery({
    queryKey: PUBLIC_COURSE_DETAILS_QUERY_KEY(course.slug),
    queryFn: () => getCoursesDetails({ slug: course.slug }),
    staleTime: 10 * 60 * 1000,
  });
  const details = detailsQuery.data;
  const lessons = details ? details.sections.reduce((sum, section) => sum + section.lessons.length, 0) : 0;
  const couponsQuery = usePublicPromoCodesQuery("course", course.id);

  const listPrice = toCount(details ? details.price : course.price);
  const discountPrice = courseDiscountPrice(listPrice, details ? details.discountPrice : course.discountPrice);
  const sellingPrice = discountPrice ?? listPrice;
  const isFree = sellingPrice <= 0;
  const coupon = isFree ? null : bestPromoCode(couponsQuery.data?.promoCodes ?? [], sellingPrice);
  const finalPrice = Math.round((sellingPrice - (coupon?.discount ?? 0)) * 100) / 100;
  const savings = Math.round((listPrice - finalPrice) * 100) / 100;
  const hasSaving = !isFree && savings > 0;
  const savingsPercent = hasSaving ? Math.round((savings / listPrice) * 100) : 0;

  const languages = course.languages?.length ? course.languages.join(", ") : course.language;
  const level = course.level ? LEVEL_LABEL[course.level] : null;

  return (
    <Link to={`/course/${course.slug}`} className={styles.featured}>
      <div className={styles.featuredThumb}>
        <img
          src={course.thumbnailImageUrl ?? Placeholder.COURSE}
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.featuredImage}
        />
      </div>

      <div className={styles.featuredInfo}>
        <span className={styles.teacher}>
          <Avatar className={styles.featuredAvatar}>
            {course.teacherAvatarUrl && <AvatarImage src={course.teacherAvatarUrl} alt="" />}
            <AvatarFallback>{initials(course.teacherName)}</AvatarFallback>
          </Avatar>
          <span className={styles.featuredTeacherName}>{course.teacherName}</span>
          <VerifiedBadge isVerified={course.teacherIsVerified} size="sm" />
        </span>
        <h3 className={styles.featuredTitle}>{course.title}</h3>
        <div className={styles.featuredPills}>
          {languages && (
            <span className={styles.metaPill} data-tone="blue">
              <Languages size={13} aria-hidden />
              {languages}
            </span>
          )}
          {level && (
            <span className={styles.metaPill} data-tone="lavender">
              <BarChart3 size={13} aria-hidden />
              {level}
            </span>
          )}
          {lessons > 0 && (
            <span className={styles.metaPill} data-tone="mint">
              <PlayCircle size={13} aria-hidden />
              {formatCount(lessons)} {lessons === 1 ? "Lesson" : "Lessons"}
            </span>
          )}
        </div>
      </div>

      <div className={styles.priceBox}>
        <span className={styles.priceRow}>
          <span className={isFree ? styles.featuredPriceFree : styles.featuredPrice}>
            {hasSaving && <span className={styles.visuallyHidden}>Now </span>}
            {isFree ? "Free" : formatRupees(finalPrice)}
          </span>
          {hasSaving && <span className={styles.discountBadge}>{savingsPercent}% OFF</span>}
        </span>
        {hasSaving && (
          <s className={styles.listPrice}>
            <span className={styles.visuallyHidden}>Original price </span>
            {formatRupees(listPrice)}
          </s>
        )}
        {coupon && (
          <span className={styles.couponLine}>
            <Tag size={13} aria-hidden className={styles.couponIcon} />
            <span>
              Use code <span className={styles.couponCode}>{coupon.promo.code}</span>
            </span>
          </span>
        )}
      </div>
    </Link>
  );
}

function FeaturedCourseSkeleton() {
  return (
    <div className={styles.featured} aria-hidden>
      <div className={styles.featuredThumb}>
        <Skeleton className={styles.skeletonFill} />
      </div>
      <div className={styles.featuredInfo}>
        <Skeleton className={styles.skeletonLineShort} />
        <Skeleton className={styles.skeletonTitle} />
        <Skeleton className={styles.skeletonLineShort} />
      </div>
      <div className={styles.priceBox}>
        <Skeleton className={styles.skeletonPrice} />
      </div>
    </div>
  );
}

/* Resources carousel */

function ResourcesCarousel({
  resources,
  isLoading,
  isError,
  onRetry,
}: {
  resources: Resource[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  const showTrack = isLoading || (!isError && resources.length > 0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateArrows();
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateArrows, resources.length, isLoading, showTrack]);

  const scrollByCards = (direction: 1 | -1) => {
    const track = trackRef.current;
    const card = track?.querySelector("li");
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    const visible = Math.max(1, Math.floor((track.clientWidth + gap) / step));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * step * visible, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section className={styles.resources} aria-labelledby="ugc-net-resources-title">
      <div className={styles.resourcesHead}>
        <div className={styles.resourcesHeading}>
          <h3 id="ugc-net-resources-title" className={styles.resourcesTitle}>
            UGC NET Resources
          </h3>
          <p className={styles.resourcesCaption}>
            Explore mock tests, notes and study materials from top UGC NET educators.
          </p>
        </div>

        <div className={styles.resourcesControls}>
          {showTrack && (canPrev || canNext) && (
            <div className={styles.arrows}>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => scrollByCards(-1)}
                disabled={!canPrev}
                aria-label="Previous resources"
                aria-controls="ugc-net-resources-track"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => scrollByCards(1)}
                disabled={!canNext}
                aria-label="Next resources"
                aria-controls="ugc-net-resources-track"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
          )}
          <Link to={ugcNetPaths.hub} className={styles.viewAll} aria-label="View all UGC NET resources">
            View all
            <ArrowRight size={15} aria-hidden className={styles.viewAllArrow} />
          </Link>
        </div>
      </div>

      {showTrack ? (
        <ul
          id="ugc-net-resources-track"
          ref={trackRef}
          className={styles.track}
          onScroll={updateArrows}
          aria-label="UGC NET resources"
          aria-busy={isLoading || undefined}
        >
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className={styles.item} aria-hidden>
                  <ResourceCardSkeleton withMedia={i % 2 === 0} />
                </li>
              ))
            : resources.map((resource) => (
                <li key={resource.key} className={styles.item}>
                  <ResourceCard resource={resource} />
                </li>
              ))}
        </ul>
      ) : isError ? (
        <Message tone="error" message="We could not load UGC NET resources right now." onRetry={onRetry} />
      ) : (
        <Message
          tone="empty"
          message="No UGC NET mock tests or notes yet. New resources land here as teachers publish them."
        />
      )}
    </section>
  );
}

/**
 * One card for either type. With a thumbnail it shows the image (notes keep
 * their badge on it, mock tests leave it clean) and the title below; without
 * one (or if the image fails) the
 * top becomes a pastel panel with the type icon, badge and title, which
 * stretches so the card matches its neighbours' height.
 */
function ResourceCard({ resource }: { resource: Resource }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!resource.thumbnailUrl && !imageFailed;
  const Icon = resource.icon;

  return (
    <Link to={resource.link} className={styles.card}>
      {showImage ? (
        <>
          <span className={styles.media}>
            <img
              src={resource.thumbnailUrl!}
              alt=""
              loading="lazy"
              decoding="async"
              className={styles.mediaImage}
              onError={() => setImageFailed(true)}
            />
            {resource.badgeOnImage && (
              <span className={styles.badge} data-on="media">
                <Icon size={12} strokeWidth={2.5} aria-hidden />
                {resource.badge}
              </span>
            )}
          </span>
          <span className={styles.cardTitle}>{resource.title}</span>
        </>
      ) : (
        <span className={styles.cover}>
          <span className={styles.coverTop}>
            <span className={styles.coverIcon} aria-hidden>
              <Icon size={18} strokeWidth={2} />
            </span>
            <span className={styles.badge}>{resource.badge}</span>
          </span>
          <span className={styles.coverTitle}>{resource.title}</span>
          <svg className={styles.coverDoodle} viewBox="0 0 40 16" aria-hidden>
            <path d="M2 10c4-6 8 6 12 0s8 6 12 0 8 6 12 0" />
          </svg>
        </span>
      )}

      <span className={styles.cardBody}>
        <span className={styles.teacher}>
          <Avatar className={styles.avatar}>
            {resource.teacherAvatarUrl && <AvatarImage src={resource.teacherAvatarUrl} alt="" />}
            <AvatarFallback>{initials(resource.teacherName)}</AvatarFallback>
          </Avatar>
          <span className={styles.teacherName}>{resource.teacherName}</span>
          <VerifiedBadge isVerified={resource.teacherIsVerified} size="sm" />
        </span>

        {resource.meta.length > 0 && (
          <span className={styles.cardMeta}>
            {resource.meta.map(({ icon: MetaIcon, text }) => (
              <span key={text} className={styles.metaItem}>
                <MetaIcon size={13} aria-hidden className={styles.metaIcon} />
                <span className={styles.metaText}>{text}</span>
              </span>
            ))}
          </span>
        )}

        <span className={styles.cardFooter}>
          <span className={styles.priceGroup}>
            {resource.originalPriceLabel && <s className={styles.originalPrice}>{resource.originalPriceLabel}</s>}
            <span className={resource.isFree ? styles.cardPriceFree : styles.cardPrice}>{resource.priceLabel}</span>
          </span>
          <span className={styles.cardArrow} aria-hidden>
            <ArrowRight size={15} />
          </span>
        </span>
      </span>
    </Link>
  );
}

function ResourceCardSkeleton({ withMedia }: { withMedia: boolean }) {
  return (
    <div className={styles.card} aria-hidden>
      {withMedia ? <Skeleton className={styles.skeletonMedia} /> : <Skeleton className={styles.skeletonCover} />}
      <span className={styles.cardBody}>
        {withMedia && <Skeleton className={styles.skeletonLine} />}
        <Skeleton className={styles.skeletonLineShort} />
        <Skeleton className={styles.skeletonFooter} />
      </span>
    </div>
  );
}

function Message({
  tone,
  message,
  onRetry,
}: {
  tone: "empty" | "error";
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.message} data-tone={tone} role={tone === "error" ? "alert" : undefined}>
      <span className={styles.messageIcon} aria-hidden>
        {tone === "error" ? <AlertCircle size={18} /> : <PenLine size={18} />}
      </span>
      <p className={styles.messageText}>{message}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          <RotateCw size={14} aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}
