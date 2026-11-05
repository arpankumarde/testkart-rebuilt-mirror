import React from "react";
import { Link } from "react-router-dom";
import { Video, Clock, IndianRupee, Users, CalendarDays, ArrowRight } from "lucide-react";
import { useMentorshipTeacherOfferingsQuery, useMentorshipGroupLessonsListQuery } from "../helpers/useMentorship";
import { groupLessonPath } from "../helpers/groupLessonRoutes";
import { Skeleton } from "./Skeleton";
import styles from "./TeacherLiveTeachingCard.module.css";

interface TeacherLiveTeachingCardProps {
  teacherId: number;
  className?: string;
}

const formatPrice = (price: number) => (price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free");

const formatWhen = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));

/**
 * Additive, self-contained card for the public teacher profile: shows this
 * teacher's bookable 1:1 session types and any open group lessons. It fetches
 * its own data client-side (mentorship/teacher-offerings_GET and
 * mentorship/group-lessons/list_GET) rather than extending the existing
 * teachers/profile_GET response, so it has zero effect on that endpoint's
 * SSR cache, prefetch, or SEO structured data. Renders nothing while loading
 * for the common case (no offerings) and nothing on error, so a teacher who
 * hasn't set up live teaching sees no change to their profile at all.
 */
export const TeacherLiveTeachingCard: React.FC<TeacherLiveTeachingCardProps> = ({ teacherId, className }) => {
  const offeringsQuery = useMentorshipTeacherOfferingsQuery(teacherId);
  const groupLessonsQuery = useMentorshipGroupLessonsListQuery({ teacherId, limit: 6 });

  const isLoading = offeringsQuery.isLoading || groupLessonsQuery.isLoading;
  const durations = offeringsQuery.data?.enabled ? offeringsQuery.data.durations : [];
  const groupLessons = groupLessonsQuery.data?.groupLessons ?? [];

  if (isLoading) {
    return (
      <div className={`${styles.card} ${className ?? ""}`} aria-busy="true">
        <Skeleton style={{ height: "1.25rem", width: "12rem" }} />
        <Skeleton style={{ height: "4rem", width: "100%" }} />
      </div>
    );
  }

  if (durations.length === 0 && groupLessons.length === 0) {
    return null;
  }

  return (
    <section className={`${styles.card} ${className ?? ""}`} aria-labelledby="live-teaching-heading">
      <h2 id="live-teaching-heading" className={styles.title}>
        <Video size={18} aria-hidden="true" /> Live teaching
      </h2>

      {durations.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>1:1 sessions</h3>
          {offeringsQuery.data?.isTrialEligible && <p className={styles.trialNote}>Your first session is a trial.</p>}
          <ul className={styles.list}>
            {durations.map((d) => (
              <li key={d.durationMinutes} className={styles.row}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowTitle}>{d.durationMinutes}-minute session</span>
                  <span className={styles.rowMeta}>
                    <Clock size={13} aria-hidden="true" /> {d.durationMinutes} min
                    <span className={styles.dot} aria-hidden="true">·</span>
                    <IndianRupee size={13} aria-hidden="true" /> {formatPrice(d.price)}
                  </span>
                </div>
                <Link to={`/live-teaching/book/${teacherId}`} className={styles.rowCta}>
                  Book <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {groupLessons.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Open group lessons</h3>
          <ul className={styles.list}>
            {groupLessons.map((lesson) => (
              <li key={lesson.id} className={styles.row}>
                {lesson.coverImageUrl ? (
                  <img src={lesson.coverImageUrl} alt="" className={styles.rowThumbnail} loading="lazy" />
                ) : (
                  <div className={styles.rowThumbnailFallback} aria-hidden="true">
                    <Video size={18} />
                  </div>
                )}
                <div className={styles.rowInfo}>
                  <span className={styles.rowTitle}>{lesson.title}</span>
                  <span className={styles.rowMeta}>
                    <CalendarDays size={13} aria-hidden="true" /> {formatWhen(lesson.startTime)}
                    <span className={styles.dot} aria-hidden="true">·</span>
                    <Users size={13} aria-hidden="true" /> {lesson.enrolledCount}/{lesson.maxCapacity}
                    <span className={styles.dot} aria-hidden="true">·</span>
                    <IndianRupee size={13} aria-hidden="true" /> {formatPrice(lesson.pricePerLearner)}
                  </span>
                </div>
                <Link to={groupLessonPath(lesson.id)} className={styles.rowCta}>
                  View <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
