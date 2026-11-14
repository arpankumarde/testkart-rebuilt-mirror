import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, Clock, Plus, Radio, Users } from "lucide-react";
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

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
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
            <Skeleton className={styles.skeleton} />
            <Skeleton className={styles.skeleton} />
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
              const discounted = c.originalPrice !== null && Number(c.originalPrice) > Number(c.price);
              return (
                <Link key={c.id} to={teacherLiveCoursePath(c.id)} className={styles.card}>
                  <div className={styles.media}>
                    {c.thumbnailUrl ? (
                      <img src={c.thumbnailUrl} alt="" className={styles.mediaImg} loading="lazy" />
                    ) : (
                      <span className={styles.mediaEmpty} aria-hidden="true">
                        <Radio size={32} />
                      </span>
                    )}
                    <span className={`${styles.status} ${styles[`tone_${status.tone}`]}`}>
                      <span className={styles.statusDot} aria-hidden="true" />
                      {status.label}
                    </span>
                  </div>

                  <div className={styles.body}>
                    <div className={styles.tags}>
                      {c.examName && <span className={`${styles.tag} ${styles.tone_lavender}`}>{c.examName}</span>}
                      <span className={styles.tag}>{LEVEL_LABEL[c.level] ?? c.level}</span>
                    </div>
                    <h2 className={styles.cardTitle}>{c.title}</h2>
                    <p className={styles.meta}>
                      <CalendarDays size={16} aria-hidden="true" />
                      <span>
                        {c.startsOn ? `${formatIstDate(c.startsOn)} to ${formatIstDate(c.endsOn ?? c.startsOn)}` : "No classes yet"}
                        <span className={styles.metaSep} aria-hidden="true">
                          &middot;
                        </span>
                        {c.classCount} {c.classCount === 1 ? "class" : "classes"}
                      </span>
                    </p>
                    {c.nextClassAt && (
                      <p className={styles.next}>
                        <Clock size={16} aria-hidden="true" />
                        <span>
                          Next class <strong>{formatIstShort(c.nextClassAt)} IST</strong>
                        </span>
                      </p>
                    )}
                  </div>

                  <div className={styles.cardFoot}>
                    <span className={styles.price}>
                      {formatRupees(c.price)}
                      {discounted && <span className={styles.struck}>{formatRupees(c.originalPrice as number)}</span>}
                    </span>
                    <span className={styles.seats}>
                      <Users size={16} aria-hidden="true" />
                      <strong>
                        {c.enrolledCount} / {c.seatLimit}
                      </strong>{" "}
                      seats
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className={styles.go} />
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
