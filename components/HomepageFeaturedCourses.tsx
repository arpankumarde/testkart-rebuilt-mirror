import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, GraduationCap, PlayCircle } from "lucide-react";
import type { HomepageFeaturedCourseItem } from "../endpoints/homepage/data_GET.schema";
import { itemPriceProps } from "../helpers/homepageItemUtils";
import { Placeholder } from "../helpers/placeholderImages";
import { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { Skeleton } from "./Skeleton";
import styles from "./HomepageFeaturedCourses.module.css";

interface HomepageFeaturedCoursesProps {
  courses: HomepageFeaturedCourseItem[];
  isLoading?: boolean;
}

const LEVEL_LABEL: Record<NonNullable<HomepageFeaturedCourseItem["level"]>, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/**
 * Hand-picked courses (helpers/homepageFetchFeaturedCourses) on an ivory panel
 * in the spotlight card language: copy and arrows on the left, a snap-scrolling
 * track of cards on the right that runs to the panel's edge so a clipped card
 * signals there is more.
 */
export function HomepageFeaturedCourses({ courses, isLoading = false }: HomepageFeaturedCoursesProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateArrows();
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateArrows, courses.length, isLoading]);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    const card = track?.querySelector("li");
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  if (!isLoading && courses.length === 0) return null;

  const showArrows = canPrev || canNext;

  return (
    <section className={styles.section} aria-labelledby="featured-courses-title">
      <div className={styles.block}>
        <span className={styles.blobPeach} aria-hidden />
        <span className={styles.blobButter} aria-hidden />
        <div className={styles.intro}>
          <span className={styles.illustration} aria-hidden>
            <PlayCircle size={22} strokeWidth={2} />
            <svg className={styles.sparkle} viewBox="0 0 16 16">
              <path d="M8 1.5c.5 3.2 1.3 4 4.5 4.5-3.2.5-4 1.3-4.5 4.5-.5-3.2-1.3-4-4.5-4.5 3.2-.5 4-1.3 4.5-4.5Z" />
            </svg>
          </span>

          <h2 id="featured-courses-title" className={styles.title}>
            Featured courses
          </h2>
          <svg className={styles.titleUnderline} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden>
            <path d="M2 6.5C20 2.5 38 8.5 58 5S98 2 118 5.5" />
          </svg>
          <p className={styles.description}>
            Picked by the Testkart team. Complete courses you can study lesson by lesson, at your own pace.
          </p>

          <div className={styles.controls}>
            {showArrows && (
              <div className={styles.arrows}>
                <button
                  type="button"
                  className={styles.arrow}
                  onClick={() => scrollByCard(-1)}
                  disabled={!canPrev}
                  aria-label="Previous courses"
                  aria-controls="featured-courses-track"
                >
                  <ChevronLeft size={20} aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.arrow}
                  onClick={() => scrollByCard(1)}
                  disabled={!canNext}
                  aria-label="Next courses"
                  aria-controls="featured-courses-track"
                >
                  <ChevronRight size={20} aria-hidden />
                </button>
              </div>
            )}
            <Link to="/course" className={styles.browseLink}>
              Browse all courses
              <ArrowRight size={16} aria-hidden className={styles.browseArrow} />
            </Link>
          </div>
        </div>

        <ul
          id="featured-courses-track"
          ref={trackRef}
          className={styles.track}
          onScroll={updateArrows}
          aria-label="Featured courses"
        >
          {isLoading && courses.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className={styles.item} aria-hidden>
                  <div className={styles.card}>
                    <Skeleton className={styles.skeletonThumb} />
                    <div className={styles.cardBody}>
                      <Skeleton className={styles.skeletonLine} />
                      <Skeleton className={styles.skeletonLineShort} />
                      <Skeleton className={styles.skeletonFooter} />
                    </div>
                  </div>
                </li>
              ))
            : courses.map((course) => (
                <li key={course.id} className={styles.item}>
                  <FeaturedCourseCard course={course} />
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}

function FeaturedCourseCard({ course }: { course: HomepageFeaturedCourseItem }) {
  const { priceLabel, originalPriceLabel, isFree } = itemPriceProps(course.price, course.discountPrice);

  return (
    <Link to={`/course/${course.slug}`} className={styles.card}>
      <div className={styles.thumb}>
        <img
          src={course.thumbnailUrl ?? Placeholder.COURSE}
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.thumbImage}
        />
      </div>

      <div className={styles.cardBody}>
        <div className={styles.badgeRow}>
          {course.examName && <span className={styles.exam}>{course.examName}</span>}
        </div>
        <h3 className={styles.courseTitle}>{course.title}</h3>

        <div className={styles.teacher}>
          <Avatar className={styles.avatar}>
            {course.teacherAvatarUrl && <AvatarImage src={course.teacherAvatarUrl} alt="" />}
            <AvatarFallback>{course.teacherName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className={styles.teacherName}>{course.teacherName}</span>
          <VerifiedBadge isVerified={course.teacherIsVerified} size="sm" />
        </div>

        <span className={styles.meta}>
          <span className={styles.metaItem}>
            <BookOpen size={14} aria-hidden className={styles.metaIcon} />
            {course.totalLessons} {course.totalLessons === 1 ? "lesson" : "lessons"}
          </span>
          {course.level && (
            <span className={styles.metaItem}>
              <GraduationCap size={14} aria-hidden className={styles.metaIcon} />
              {LEVEL_LABEL[course.level]}
            </span>
          )}
        </span>

        <div className={styles.footer}>
          <span className={styles.priceGroup}>
            {originalPriceLabel && <s className={styles.originalPrice}>{originalPriceLabel}</s>}
            <span className={isFree ? styles.priceFree : styles.price}>{priceLabel}</span>
          </span>
          <span className={styles.cardArrow} aria-hidden>
            <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
