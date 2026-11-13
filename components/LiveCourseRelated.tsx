import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Users, Video } from "lucide-react";
import type { LiveCourseSummary } from "../helpers/liveCourseData";
import { LIVE_COURSE_LIST_PATH, formatIstDate, formatRupees, liveCoursePath } from "../helpers/liveCourseRules";
import { useLiveCoursesQuery } from "../helpers/useLiveCourses";
import styles from "./LiveCourseRelated.module.css";

const SHOW = 4;

const RelatedCard: React.FC<{ course: LiveCourseSummary }> = ({ course }) => {
  const seatsLeft = Math.max(0, course.seatLimit - course.enrolledCount);
  const off =
    course.originalPrice && course.originalPrice > course.price ? Math.round((1 - course.price / course.originalPrice) * 100) : 0;
  return (
    <Link to={liveCoursePath(course.slug)} className={styles.card}>
      <span className={styles.media}>
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt="" className={styles.thumb} loading="lazy" />
        ) : (
          <span className={styles.thumbFallback} aria-hidden="true">
            <Video size={28} />
          </span>
        )}
      </span>
      <span className={styles.body}>
        <span className={styles.chips}>
          <span className={`${styles.chip} ${styles.live}`}>Live</span>
          {course.examName && <span className={`${styles.chip} ${styles.exam}`}>{course.examName}</span>}
        </span>
        <span className={styles.title}>{course.title}</span>
        <span className={styles.teacher}>by {course.teacher.name}</span>
        <span className={styles.facts}>
          <span>
            <CalendarDays size={13} aria-hidden="true" />
            {course.startsOn ? formatIstDate(course.startsOn) : "Dates soon"} &middot; {course.classCount} classes
          </span>
        </span>
        <span className={styles.foot}>
          <span className={styles.price}>
            <strong>{formatRupees(course.price)}</strong>
            {off > 0 && <s>{formatRupees(course.originalPrice!)}</s>}
          </span>
          <span className={styles.seats}>
            <Users size={12} aria-hidden="true" /> {seatsLeft} left
          </span>
        </span>
      </span>
    </Link>
  );
};

/** Open live batches for the same exam, else the same teacher, else any. Draws nothing when there are none. */
export const LiveCourseRelated: React.FC<{ course: { id: string; examId: number | null; teacher: { id: number; name: string } } }> = ({
  course,
}) => {
  const primaryInput = course.examId ? { examId: course.examId, limit: SHOW + 1 } : { teacherId: course.teacher.id, limit: SHOW + 1 };
  const primary = useLiveCoursesQuery(primaryInput);
  const primaryCourses = (primary.data?.courses ?? []).filter((c) => c.id !== course.id);
  const needFallback = primary.isSuccess && primaryCourses.length === 0;
  const fallback = useLiveCoursesQuery({ limit: SHOW + 1 }, needFallback);
  const courses = (needFallback ? (fallback.data?.courses ?? []).filter((c) => c.id !== course.id) : primaryCourses).slice(0, SHOW);

  if (courses.length === 0) return null;
  const heading = needFallback ? "More live batches" : course.examId ? "More live batches for this exam" : `More from ${course.teacher.name}`;

  return (
    <section className={styles.section} aria-labelledby="lc-related">
      <div className={styles.head}>
        <h2 id="lc-related" className={styles.h2}>
          {heading}
        </h2>
        <Link to={LIVE_COURSE_LIST_PATH} className={styles.all}>
          Browse all <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.grid}>
        {courses.map((c) => (
          <RelatedCard key={c.id} course={c} />
        ))}
      </div>
    </section>
  );
};
