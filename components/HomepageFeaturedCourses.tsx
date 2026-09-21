import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HomepageFeaturedCourseItem } from "../endpoints/homepage/data_GET.schema";
import { formatItemPrice } from "../helpers/homepageItemUtils";
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
 * Hand-picked courses (helpers/homepageFetchFeaturedCourses) on one brand coral
 * block: copy and arrows on the left, a snap-scrolling track of cards on the
 * right that runs to the block's edge so a clipped card signals there is more.
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
        <div className={styles.intro}>
          <h2 id="featured-courses-title" className={styles.title}>
            Featured courses
          </h2>
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
  const isFree = course.price === 0;

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
        <span className={styles.exam}>{course.examName ?? ""}</span>
        <h3 className={styles.courseTitle}>{course.title}</h3>

        <div className={styles.teacher}>
          <Avatar className={styles.avatar}>
            {course.teacherAvatarUrl && <AvatarImage src={course.teacherAvatarUrl} alt="" />}
            <AvatarFallback>{course.teacherName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className={styles.teacherName}>{course.teacherName}</span>
          <VerifiedBadge isVerified={course.teacherIsVerified} size="sm" />
        </div>

        <div className={styles.footer}>
          <span className={styles.meta}>
            <span>
              {course.totalLessons} {course.totalLessons === 1 ? "lesson" : "lessons"}
            </span>
            {course.level && <span>{LEVEL_LABEL[course.level]}</span>}
          </span>
          <span className={isFree ? styles.priceFree : styles.price}>
            {formatItemPrice(course.price)}
          </span>
        </div>
      </div>
    </Link>
  );
}
