import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { CalendarDays, Plus, Radio, Users } from "lucide-react";
import { useTeacherLiveCoursesQuery } from "../helpers/useLiveCourses";
import { formatIstDate, formatIstShort, formatRupees, teacherLiveCoursePath } from "../helpers/liveCourseRules";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import styles from "./teacher.live-courses.module.css";

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "butter" },
  published: { label: "Live", tone: "mint" },
  completed: { label: "Completed", tone: "sage" },
  cancelled: { label: "Cancelled", tone: "peach" },
};

const TeacherLiveCoursesPage: React.FC = () => {
  const { data, isLoading } = useTeacherLiveCoursesQuery();
  const canCreate = data?.canCreate ?? false;
  const createButton = canCreate ? (
    <Button asChild>
      <Link to={teacherLiveCoursePath("new")}>
        <Plus size={16} /> New live course
      </Link>
    </Button>
  ) : data ? (
    <Button asChild>
      <Link to="/teacher/mentorship">Apply to teach live</Link>
    </Button>
  ) : null;

  return (
    <>
      <Helmet>
        <title>Live courses - Testkart</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <ConsolePageHeader title="Live courses">{createButton}</ConsolePageHeader>

        {isLoading ? (
          <div className={styles.grid}>
            <Skeleton style={{ height: "11rem", borderRadius: "1.25rem" }} />
            <Skeleton style={{ height: "11rem", borderRadius: "1.25rem" }} />
          </div>
        ) : !data || data.courses.length === 0 ? (
          <ConsoleListEmpty
            icon={<Radio size={28} />}
            title="No live courses yet"
            description={canCreate ? "Plan a batch of live classes with a syllabus and a timetable." : "Live courses open once your live teaching application is approved."}
          >
            {createButton}
          </ConsoleListEmpty>
        ) : (
          <div className={styles.grid}>
            {data.courses.map((c) => {
              const status = STATUS[c.status] ?? STATUS.draft;
              return (
                <Link key={c.id} to={teacherLiveCoursePath(c.id)} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={`${styles.chip} ${styles[`tone_${status.tone}`]}`}>{status.label}</span>
                    {c.examName && <span className={`${styles.chip} ${styles.tone_lavender}`}>{c.examName}</span>}
                  </div>
                  <h2 className={styles.cardTitle}>{c.title}</h2>
                  <p className={styles.meta}>
                    <CalendarDays size={14} aria-hidden="true" />
                    {c.startsOn ? `${formatIstDate(c.startsOn)} to ${formatIstDate(c.endsOn ?? c.startsOn)}` : "No classes yet"}
                    <span aria-hidden="true">&middot;</span>
                    {c.classCount} {c.classCount === 1 ? "class" : "classes"}
                  </p>
                  {c.nextClassAt && <p className={styles.next}>Next class {formatIstShort(c.nextClassAt)} IST</p>}
                  <div className={styles.cardFoot}>
                    <span className={styles.price}>{formatRupees(c.price)}</span>
                    <span className={styles.seats}>
                      <Users size={14} aria-hidden="true" /> {c.enrolledCount} / {c.seatLimit}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default TeacherLiveCoursesPage;
