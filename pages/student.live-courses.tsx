import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import { useStudentLiveCoursesQuery } from "../helpers/useLiveCourses";
import { LIVE_COURSE_LIST_PATH, formatIstShort } from "../helpers/liveCourseRules";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { LiveCourseTimetable } from "../components/LiveCourseTimetable";
import styles from "./student.live-courses.module.css";

const StudentLiveCoursesPage: React.FC = () => {
  const { data, isLoading } = useStudentLiveCoursesQuery();
  const active = (data?.courses ?? []).filter((c) => c.enrollmentStatus === "enrolled");
  const other = (data?.courses ?? []).filter((c) => c.enrollmentStatus !== "enrolled");

  return (
    <>
      <Helmet>
        <title>My live courses - Testkart</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <ConsolePageHeader title="My live courses" />
        {isLoading ? (
          <Skeleton style={{ height: "12rem", borderRadius: "1.25rem" }} />
        ) : !data || data.courses.length === 0 ? (
          <ConsoleListEmpty icon={<Radio size={28} />} title="No live courses yet" description="Join a batch of live classes with a teacher.">
            <Button asChild>
              <Link to={LIVE_COURSE_LIST_PATH}>Browse live courses</Link>
            </Button>
          </ConsoleListEmpty>
        ) : (
          <>
            <section className={styles.section}>
              <h2 className={styles.h2}>Coming up</h2>
              {data.timetable.length ? (
                <LiveCourseTimetable entries={data.timetable} />
              ) : (
                <p className={styles.empty}>No classes in the next two weeks.</p>
              )}
            </section>

            {active.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.h2}>Courses</h2>
                <div className={styles.grid}>
                  {active.map((c) => (
                    <Link key={c.id} to={`/student/live-courses/${c.id}`} className={styles.card}>
                      <strong className={styles.title}>{c.title}</strong>
                      <span className={styles.meta}>{c.teacher.name}</span>
                      <span className={styles.meta}>
                        {c.nextClass ? `Next: ${formatIstShort(c.nextClass.startTime)} IST` : "No classes left"}
                      </span>
                      <span className={styles.progress}>
                        Attended {c.classesAttended} of {c.classesHeld}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {other.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.h2}>Refunded</h2>
                <div className={styles.grid}>
                  {other.map((c) => (
                    <Link key={c.id} to={`/student/live-courses/${c.id}`} className={`${styles.card} ${styles.cardMuted}`}>
                      <strong className={styles.title}>{c.title}</strong>
                      <span className={styles.meta}>{c.teacher.name}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default StudentLiveCoursesPage;
