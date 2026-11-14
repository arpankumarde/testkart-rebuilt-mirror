import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Clock, ExternalLink, IndianRupee, Radio, Send, Undo2, Users } from "lucide-react";
import {
  usePublishLiveCourseMutation,
  useTeacherLiveCourseQuery,
  useTeacherLiveCourseStudentsQuery,
  useUpsertLiveCourseMutation,
} from "../helpers/useLiveCourses";
import { formatRupees, liveCoursePath, teacherLiveCoursePath, teacherLiveCoursesPath } from "../helpers/liveCourseRules";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { SegmentedControl } from "../components/SegmentedControl";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import {
  LiveCourseDetailsForm,
  LiveCourseSchedule,
  LiveCourseStudents,
  LiveCourseSyllabusEditor,
} from "../components/LiveCourseEditor";
import styles from "./teacher.live-courses.$id.module.css";

type Tab = "details" | "syllabus" | "schedule" | "students";

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

const formatDay = (at: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(at));

const BackLink: React.FC = () => (
  <nav aria-label="Breadcrumb">
    <Link to={teacherLiveCoursesPath} className={styles.back}>
      <ArrowLeft size={16} aria-hidden="true" /> Live courses
    </Link>
  </nav>
);

const TabLabel: React.FC<{ label: string; count?: number }> = ({ label, count }) => (
  <>
    {label}
    {count !== undefined && <span className={styles.count}>{count}</span>}
  </>
);

const NewLiveCourse: React.FC = () => {
  const navigate = useNavigate();
  const upsert = useUpsertLiveCourseMutation();
  return (
    <div className={`${styles.page} tk-flow`}>
      <BackLink />
      <ConsolePageHeader title="New live course" description="Start with the basics. Add the syllabus and the timetable next." />
      <LiveCourseDetailsForm
        course={null}
        pending={upsert.isPending}
        submitLabel="Create and continue"
        onSubmit={(values) =>
          upsert.mutate(values, {
            onSuccess: (r) => {
              toast.success("Live course created.");
              navigate(`${teacherLiveCoursePath(r.id)}?tab=schedule`, { replace: true });
            },
            onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create the course."),
          })
        }
      />
    </div>
  );
};

const LoadingState: React.FC = () => (
  <div className={styles.page} aria-busy="true" aria-label="Loading live course">
    <Skeleton className={styles.skeletonBack} />
    <Skeleton className={styles.skeletonTitle} />
    <Skeleton className={styles.skeletonTabs} />
    <Skeleton className={styles.skeletonCard} />
    <Skeleton className={styles.skeletonCard} />
  </div>
);

const EditLiveCourse: React.FC<{ id: string }> = ({ id }) => {
  const initialTab = (new URLSearchParams(window.location.search).get("tab") as Tab) || "details";
  const [tab, setTab] = useState<Tab>(initialTab);
  const { data, isLoading, error } = useTeacherLiveCourseQuery(id);
  const students = useTeacherLiveCourseStudentsQuery(id, tab === "students");
  const upsert = useUpsertLiveCourseMutation();
  const publish = usePublishLiveCourseMutation();
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);

  if (isLoading) return <LoadingState />;
  if (error || !data) {
    return (
      <div className={`${styles.page} tk-flow`}>
        <BackLink />
        <ConsoleListEmpty tone="error" title="Live course not found" description={error instanceof Error ? error.message : "It may have been removed."}>
          <Button variant="outline" asChild>
            <Link to={teacherLiveCoursesPath}>Back to live courses</Link>
          </Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  const course = data.course;
  const status = STATUS[course.status] ?? STATUS.draft;
  const editable = course.status === "draft" || course.status === "published";
  const pageHref = liveCoursePath(course.slug);
  const canUnpublish = course.status === "published" && course.enrolledCount === 0;
  const now = Date.now();
  const nextClass = course.classes
    .filter((c) => c.status === "scheduled" && new Date(c.startTime).getTime() > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  return (
    <>
      <Helmet>
        <title>{`${course.title} - Live course - Testkart`}</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <BackLink />

        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.thumb} aria-hidden="true">
              {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" className={styles.thumbImg} /> : <Radio size={24} />}
            </div>
            <div className={styles.heroMain}>
              <div className={styles.chips}>
                <span className={`${styles.statusPill} ${styles[`pill_${status.tone}`]}`}>
                  <span className={styles.pillDot} aria-hidden="true" />
                  {status.label}
                </span>
                {course.examName && <span className={styles.tag}>{course.examName}</span>}
                <span className={styles.tag}>{LEVEL_LABEL[course.level] ?? course.level}</span>
              </div>
              <h1 className={styles.title}>{course.title}</h1>
            </div>
            <div className={styles.actions}>
              {canUnpublish && (
                <Button variant="ghost" className={styles.quiet} onClick={() => setConfirm("unpublish")}>
                  <Undo2 size={16} aria-hidden="true" /> Back to draft
                </Button>
              )}
              {course.status !== "draft" && (
                <Button variant="outline" asChild>
                  <a href={pageHref} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} aria-hidden="true" /> View page
                  </a>
                </Button>
              )}
              {course.status === "draft" && (
                <Button onClick={() => setConfirm("publish")}>
                  <Send size={16} aria-hidden="true" /> Publish
                </Button>
              )}
            </div>
          </div>

          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>
                <IndianRupee size={14} aria-hidden="true" /> Price
              </dt>
              <dd>
                {formatRupees(course.price)}
                {course.originalPrice && Number(course.originalPrice) > Number(course.price) && (
                  <span className={styles.struck}>{formatRupees(course.originalPrice)}</span>
                )}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>
                <CalendarDays size={14} aria-hidden="true" /> Classes
              </dt>
              <dd>{course.classCount}</dd>
            </div>
            <div className={styles.stat}>
              <dt>
                <Users size={14} aria-hidden="true" /> Seats filled
              </dt>
              <dd>
                {course.enrolledCount}
                <span className={styles.statOf}> / {course.seatLimit}</span>
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>
                <Clock size={14} aria-hidden="true" /> Next class
              </dt>
              <dd>{nextClass ? formatDay(nextClass.startTime) : "None scheduled"}</dd>
            </div>
          </dl>
        </header>

        {course.status === "cancelled" && (
          <p className={styles.banner} role="status">
            This course was cancelled{course.cancellationReason ? `: ${course.cancellationReason}` : "."}
          </p>
        )}

        <div className={styles.tabsScroller}>
          <SegmentedControl
            aria-label="Course sections"
            value={tab}
            onValueChange={setTab}
            className={styles.tabs}
            options={[
              { value: "details", label: "Details" },
              { value: "syllabus", label: "Syllabus" },
              {
                value: "schedule",
                label: <TabLabel label="Classes" count={course.classCount} />,
                ariaLabel: `Classes, ${course.classCount}`,
              },
              {
                value: "students",
                label: <TabLabel label="Students" count={course.enrolledCount} />,
                ariaLabel: `Students, ${course.enrolledCount}`,
              },
            ]}
          />
        </div>

        <div className={styles.panel}>
          {tab === "details" &&
            (editable ? (
              <LiveCourseDetailsForm
                course={course}
                pending={upsert.isPending}
                submitLabel="Save details"
                platformFeePercentage={data.earnings.platformFeePercentage}
                onSubmit={(values) =>
                  upsert.mutate(
                    { ...values, id: course.id },
                    {
                      onSuccess: () => toast.success("Saved."),
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
                    }
                  )
                }
              />
            ) : (
              <p className={styles.banner}>A {course.status} course cannot be edited.</p>
            ))}
          {tab === "syllabus" && <LiveCourseSyllabusEditor course={course} readOnly={!editable} />}
          {tab === "schedule" && (
            <LiveCourseSchedule course={course} refundClosesAt={data.refundClosesAt} mode="teacher" earnings={data.earnings} />
          )}
          {tab === "students" && (
            <LiveCourseStudents
              roster={students.data}
              loading={students.isLoading}
              canMark
              viewPageHref={course.status === "published" ? pageHref : undefined}
            />
          )}
        </div>
      </div>

      <ConsoleConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "publish" ? "Publish this live course?" : "Move back to draft?"}
        description={
          confirm === "publish"
            ? `It goes on sale straight away at its own page. Students can buy until the registration deadline or until seats run out.${
                data.earnings.perClassPerStudent > 0
                  ? ` Your pay is fixed now: ${formatRupees(data.earnings.perClassPerStudent)} per student for each class you hold, up to ${formatRupees(data.earnings.perStudent)} per student.`
                  : ""
              }`
            : "The course page goes offline until you publish again."
        }
        confirmLabel={confirm === "publish" ? "Publish" : "Move to draft"}
        pendingLabel="Saving..."
        isPending={publish.isPending}
        onConfirm={() =>
          publish.mutate(
            { liveCourseId: course.id, action: confirm === "publish" ? "publish" : "unpublish" },
            {
              onSuccess: (r) => {
                toast.success(r.status === "published" ? "Published. Your course page is live." : "Moved back to draft.");
                setConfirm(null);
              },
              onError: (e) => {
                toast.error(e instanceof Error ? e.message : "Could not update the course.");
                setConfirm(null);
              },
            }
          )
        }
      />
    </>
  );
};

const TeacherLiveCoursePage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  if (id === "new") return <NewLiveCourse />;
  return <EditLiveCourse key={id} id={id} />;
};

export default TeacherLiveCoursePage;
