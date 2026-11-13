import React from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLiveCourseQuery } from "../helpers/useLiveCourses";
import { LIVE_COURSE_LIST_PATH } from "../helpers/liveCourseRules";
import { LiveCourseView, useCashfreeReturn } from "../components/LiveCourseView";
import { Skeleton } from "../components/Skeleton";
import { NotFoundState } from "../components/NotFoundState";
import styles from "./live-courses.$slug.module.css";

const LiveCoursePage: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  useCashfreeReturn();
  const { data, isLoading, error } = useLiveCourseQuery({ slug });

  if (isLoading) {
    return (
      <div className={`${styles.page} tk-flow`}>
        <Skeleton style={{ height: "2rem", width: "min(28rem, 90%)" }} />
        <Skeleton style={{ height: "18rem", width: "100%", borderRadius: "1.5rem" }} />
      </div>
    );
  }
  if (!data) {
    if (error instanceof Error && /not found/i.test(error.message)) return <NotFoundState kind="page" />;
    return (
      <div className={`${styles.page} tk-flow`}>
        <p>Could not load this live course. Please try again.</p>
      </div>
    );
  }

  const c = data.course;
  const description = (c.description || `Live classes with ${c.teacher.name} on Testkart.`).replace(/\s+/g, " ").slice(0, 160);
  return (
    <>
      <Helmet>
        <title>{`${c.title} | Live Course | Testkart`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`https://testkart.in/live-courses/${c.slug}`} />
        {c.status === "draft" && <meta name="robots" content="noindex" />}
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <Link to={LIVE_COURSE_LIST_PATH} className={styles.back}>
          <ArrowLeft size={15} aria-hidden="true" /> All live courses
        </Link>
        {c.status === "draft" && <p className={styles.preview}>Preview: this course is a draft and only you can see it.</p>}
        <LiveCourseView data={data} />
      </div>
    </>
  );
};

export default LiveCoursePage;
