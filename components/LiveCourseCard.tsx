import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Users, Video } from "lucide-react";
import type { LiveCourseSummary } from "../helpers/liveCourseData";
import { formatIstDate, formatRupees, liveCoursePath } from "../helpers/liveCourseRules";
import { useLiveCoursesQuery } from "../helpers/useLiveCourses";
import styles from "./LiveCourseCard.module.css";

export const LiveCourseCard: React.FC<{ course: LiveCourseSummary }> = ({ course }) => {
  const seatsLeft = Math.max(0, course.seatLimit - course.enrolledCount);
  return (
    <Link to={liveCoursePath(course.slug)} className={styles.card}>
      {course.thumbnailUrl ? (
        <img src={course.thumbnailUrl} alt="" className={styles.thumb} loading="lazy" />
      ) : (
        <span className={styles.thumbFallback} aria-hidden="true">
          <Video size={28} />
        </span>
      )}
      <div className={styles.body}>
        <div className={styles.chips}>
          <span className={`${styles.chip} ${styles.live}`}>Live course</span>
          {course.examName && <span className={`${styles.chip} ${styles.exam}`}>{course.examName}</span>}
        </div>
        <h3 className={styles.title}>{course.title}</h3>
        <span className={styles.teacher}>{course.teacher.name}</span>
        <ul className={styles.facts}>
          <li>
            <CalendarDays size={13} aria-hidden="true" />
            {course.startsOn ? `Starts ${formatIstDate(course.startsOn)}` : "Dates soon"} &middot; {course.classCount} classes
          </li>
          <li>
            <Users size={13} aria-hidden="true" /> {seatsLeft} {seatsLeft === 1 ? "seat" : "seats"} left
          </li>
        </ul>
        <div className={styles.price}>
          <strong>{formatRupees(course.price)}</strong>
          {course.originalPrice && course.originalPrice > course.price && <s>{formatRupees(course.originalPrice)}</s>}
        </div>
      </div>
    </Link>
  );
};

/** A titled grid of open live courses for an exam or a teacher. Draws nothing when there are none. */
export const LiveCourseSection: React.FC<{ title: string; examSlug?: string; examId?: number; teacherId?: number }> = ({
  title,
  examSlug,
  examId,
  teacherId,
}) => {
  const { data } = useLiveCoursesQuery({ examSlug, examId, teacherId, limit: 12 }, !!(examSlug || examId || teacherId));
  if (!data || data.courses.length === 0) return null;
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.grid}>
        {data.courses.map((c) => (
          <LiveCourseCard key={c.id} course={c} />
        ))}
      </div>
    </section>
  );
};
