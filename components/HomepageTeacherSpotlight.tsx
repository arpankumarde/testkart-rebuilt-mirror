import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Library, RotateCw, Users } from "lucide-react";
import type { HomepageTeacher } from "../endpoints/homepage/data_GET.schema";
import { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { Skeleton } from "./Skeleton";
import styles from "./HomepageTeacherSpotlight.module.css";

const SPOTLIGHT_SIZE = 10;
const SKELETON_COUNT = 5;

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString("en-IN")} ${count === 1 ? one : many}`;

const getInitials = (name: string) => name.trim().substring(0, 2).toUpperCase();

function describeTeacher(teacher: HomepageTeacher): string | null {
  const tagline = teacher.tagline?.trim().replace(/^"(.*)"$/, "$1");
  if (tagline) return tagline;
  const exams = (teacher.targetExams ?? []).filter((exam) => exam && exam !== "Other");
  return exams.length > 0 ? `Teaches ${exams.slice(0, 2).join(", ")}` : null;
}

const resourceCount = (teacher: HomepageTeacher) => teacher.testCount + teacher.courseCount + teacher.productCount;

interface HomepageTeacherSpotlightProps {
  teachers: HomepageTeacher[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

/**
 * Top 10 teachers from homepage/data popularTeachers, which the server ranks
 * by sales over the rolling last 30 days (helpers/homepageFetchPopularTeachers);
 * the array order is the rank, so nothing is re-sorted here. A snap-scrolling
 * track with prev/next arrows on the pine showcase panel shared with
 * HomepageFeaturedCourses.
 */
export function HomepageTeacherSpotlight({
  teachers,
  isLoading = false,
  isError = false,
  onRetry,
}: HomepageTeacherSpotlightProps) {
  const spotlight = teachers.filter((t) => resourceCount(t) > 0).slice(0, SPOTLIGHT_SIZE);
  const showSkeleton = isLoading && spotlight.length === 0;
  const showError = !showSkeleton && isError && spotlight.length === 0;
  const showEmpty = !showSkeleton && !showError && spotlight.length === 0;

  const trackRef = useRef<HTMLOListElement>(null);
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
    if (!track) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    updateArrows();
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateArrows, spotlight.length, showSkeleton]);

  const scrollByCards = (direction: 1 | -1) => {
    const track = trackRef.current;
    const card = track?.querySelector("li");
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    const perView = Math.max(1, Math.floor((track.clientWidth + gap) / step));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * step * perView, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const showArrows = canPrev || canNext;

  return (
    <section className={styles.section} aria-labelledby="teacher-spotlight-title">
      <div className={styles.block}>
        <span className={styles.blobPeach} aria-hidden />
        <span className={styles.blobButter} aria-hidden />
        <div className={styles.head}>
          <div className={styles.headCopy}>
            <span className={styles.illustration} aria-hidden>
              <Users size={22} strokeWidth={2} />
              <svg className={styles.sparkle} viewBox="0 0 16 16">
                <path d="M8 1.5c.5 3.2 1.3 4 4.5 4.5-3.2.5-4 1.3-4.5 4.5-.5-3.2-1.3-4-4.5-4.5 3.2-.5 4-1.3 4.5-4.5Z" />
              </svg>
            </span>
            <div className={styles.titleGroup}>
              <h2 id="teacher-spotlight-title" className={styles.title}>
                Top teachers on Testkart
              </h2>
              <svg className={styles.titleUnderline} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden>
                <path d="M2 6.5C20 2.5 38 8.5 58 5S98 2 118 5.5" />
              </svg>
            </div>
          </div>

          {showArrows && (
            <div className={styles.arrows}>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => scrollByCards(-1)}
                disabled={!canPrev}
                aria-label="Previous teachers"
                aria-controls="teacher-spotlight-track"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => scrollByCards(1)}
                disabled={!canNext}
                aria-label="Next teachers"
                aria-controls="teacher-spotlight-track"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
          )}
        </div>

        {showError ? (
          <div className={styles.status} role="alert">
            <p className={styles.statusText}>We couldn't load the top teachers right now.</p>
            {onRetry && (
              <button type="button" className={styles.retry} onClick={onRetry}>
                <RotateCw size={16} aria-hidden />
                Try again
              </button>
            )}
          </div>
        ) : showEmpty ? (
          <div className={styles.status}>
            <p className={styles.statusText}>No teacher sales in the last 30 days yet. Check back soon.</p>
          </div>
        ) : (
          <ol
            id="teacher-spotlight-track"
            ref={trackRef}
            className={styles.track}
            onScroll={updateArrows}
            aria-label="Top teachers by sales in the last 30 days"
            aria-busy={showSkeleton || undefined}
          >
            {showSkeleton
              ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                  <li key={i} className={styles.item} aria-hidden>
                    <div className={styles.card}>
                      <Skeleton className={styles.skeletonAvatar} />
                      <div className={styles.body}>
                        <Skeleton className={styles.skeletonLine} />
                        <Skeleton className={styles.skeletonLineShort} />
                      </div>
                    </div>
                  </li>
                ))
              : spotlight.map((teacher, index) => (
                  <li key={teacher.id} className={styles.item}>
                    <TeacherCard teacher={teacher} rank={index + 1} />
                  </li>
                ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function TeacherCard({ teacher, rank }: { teacher: HomepageTeacher; rank: number }) {
  const description = describeTeacher(teacher);
  const resources = plural(resourceCount(teacher), "Resource", "Resources");
  const followers = plural(teacher.followerCount ?? 0, "Follower", "Followers");
  const name = teacher.displayName.trim();

  return (
    <Link to={`/expert/${teacher.slug}`} className={styles.card}>
      <span className={styles.rank} aria-label={`Rank ${rank}`}>
        #{rank}
      </span>

      <Avatar className={styles.avatar}>
        {teacher.avatarUrl && <AvatarImage src={teacher.avatarUrl} alt="" />}
        <AvatarFallback className={styles.avatarFallback}>{getInitials(name)}</AvatarFallback>
      </Avatar>

      <div className={styles.body}>
        <span className={styles.nameRow}>
          <span className={styles.name}>{name}</span>
          <VerifiedBadge isVerified={teacher.isVerified} size="sm" className={styles.verified} />
        </span>
        {description && <span className={styles.tagline}>{description}</span>}
        <span className={styles.stats}>
          <span className={styles.stat}>
            <Library size={15} aria-hidden className={styles.statIcon} />
            {resources}
          </span>
          <span className={styles.stat}>
            <Users size={15} aria-hidden className={styles.statIcon} />
            {followers}
          </span>
        </span>
      </div>

      <span className={styles.cta}>
        View profile
        <span className={styles.ctaArrow} aria-hidden>
          <ArrowRight size={16} />
        </span>
      </span>
    </Link>
  );
}
