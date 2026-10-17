import React from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, GraduationCap } from "lucide-react";
import { useTestsQuery } from "../helpers/useTestsQuery";
import { usePublicCoursesQuery } from "../helpers/useStudentCoursesQuery";
import { formatItemPrice } from "../helpers/homepageItemUtils";
import { Skeleton } from "./Skeleton";
import styles from "./CurrentAffairsTeacherPicks.module.css";

const MAX_PICKS = 3;

type Pick = {
  key: string;
  href: string;
  title: string;
  teacherName: string | null;
  price: string;
  thumbnailUrl: string | null;
  kind: "Mock test" | "Course";
};

/*
 * "From teachers on Testkart": popular mock tests and courses for the exam the latest digest is
 * tagged with, or across all exams when it has none. Shows a short note when nothing comes back.
 */
export const CurrentAffairsTeacherPicks: React.FC<{ examId: number | null }> = ({ examId }) => {
  const filter = examId ? { examId: String(examId) } : {};
  const tests = useTestsQuery({ ...filter, limit: "2", sortBy: "popular" });
  const courses = usePublicCoursesQuery({ ...filter, limit: "2", sortBy: "popular" });

  if (tests.isLoading || courses.isLoading) {
    return (
      <div className={styles.list} aria-busy="true">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} style={{ height: "3.5rem", borderRadius: "var(--radius-md)" }} />
        ))}
      </div>
    );
  }

  const picks: Pick[] = [
    ...(tests.data?.tests ?? []).map((test) => ({
      key: `t-${test.id}`,
      href: `/mock-test/${test.slug}`,
      title: test.title,
      teacherName: test.teacherName,
      price: formatItemPrice(test.price, test.discountPrice),
      thumbnailUrl: test.thumbnailUrl,
      kind: "Mock test" as const,
    })),
    ...(courses.data?.courses ?? []).map((course) => ({
      key: `c-${course.id}`,
      href: `/course/${course.slug}`,
      title: course.title,
      teacherName: course.teacherName,
      price: formatItemPrice(Number(course.price), course.discountPrice === null ? null : Number(course.discountPrice)),
      thumbnailUrl: course.thumbnailImageUrl || course.thumbnailUrl,
      kind: "Course" as const,
    })),
  ].slice(0, MAX_PICKS);

  if (picks.length === 0) {
    return (
      <p className={styles.empty}>
        No teacher picks right now. <Link to="/course">Browse courses</Link>
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {picks.map((pick) => (
        <li key={pick.key}>
          <Link to={pick.href} className={styles.pick}>
            {pick.thumbnailUrl ? (
              <img src={pick.thumbnailUrl} alt="" className={styles.thumb} loading="lazy" />
            ) : (
              <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true">
                {pick.kind === "Course" ? <GraduationCap size={18} /> : <ClipboardCheck size={18} />}
              </span>
            )}
            <span className={styles.body}>
              <span className={styles.title}>{pick.title}</span>
              <span className={styles.meta}>
                {pick.kind}
                {pick.teacherName && <> - {pick.teacherName}</>}
              </span>
              <span className={styles.price}>{pick.price}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};