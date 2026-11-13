import React from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLiveCourseQuery } from "../helpers/useLiveCourses";
import { studentLiveCoursesPath } from "../helpers/liveCourseRules";
import { LiveCourseView, useCashfreeReturn } from "../components/LiveCourseView";
import { Skeleton } from "../components/Skeleton";
import styles from "./student.live-courses.$id.module.css";

/* The enrolled student's view of a live course: timetable with Join, own attendance, refund. */
const StudentLiveCoursePage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  useCashfreeReturn();
  const { data, isLoading, error } = useLiveCourseQuery({ id });

  return (
    <>
      <Helmet>
        <title>{data ? `${data.course.title} - Testkart` : "Live course - Testkart"}</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <Link to={studentLiveCoursesPath} className={styles.back}>
          <ArrowLeft size={14} aria-hidden="true" /> My live courses
        </Link>
        {isLoading ? (
          <Skeleton style={{ height: "18rem", borderRadius: "1.25rem" }} />
        ) : !data ? (
          <p className={styles.error}>{error instanceof Error ? error.message : "Could not load this course."}</p>
        ) : (
          <LiveCourseView data={data} />
        )}
      </div>
    </>
  );
};

export default StudentLiveCoursePage;
