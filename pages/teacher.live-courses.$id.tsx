import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Send, Undo2 } from "lucide-react";
import {
  usePublishLiveCourseMutation,
  useTeacherLiveCourseQuery,
  useTeacherLiveCourseStudentsQuery,
  useUpsertLiveCourseMutation,
} from "../helpers/useLiveCourses";
import { liveCoursePath, teacherLiveCoursePath, teacherLiveCoursesPath } from "../helpers/liveCourseRules";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
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

const NewLiveCourse: React.FC = () => {
  const navigate = useNavigate();
  const upsert = useUpsertLiveCourseMutation();
  return (
    <div className={`${styles.page} tk-flow`}>
      <Link to={teacherLiveCoursesPath} className={styles.back}>
        <ArrowLeft size={14} /> Live courses
      </Link>
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

const EditLiveCourse: React.FC<{ id: string }> = ({ id }) => {
  const initialTab = (new URLSearchParams(window.location.search).get("tab") as Tab) || "details";
  const [tab, setTab] = useState<Tab>(initialTab);
  const { data, isLoading, error } = useTeacherLiveCourseQuery(id);
  const students = useTeacherLiveCourseStudentsQuery(id, tab === "students");
  const upsert = useUpsertLiveCourseMutation();
  const publish = usePublishLiveCourseMutation();
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);

  if (isLoading) return <Skeleton style={{ height: "20rem", borderRadius: "1.25rem" }} />;
  if (error || !data) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error instanceof Error ? error.message : "Live course not found."}</p>
        <Link to={teacherLiveCoursesPath}>Back to live courses</Link>
      </div>
    );
  }

  const course = data.course;
  const status = STATUS[course.status] ?? STATUS.draft;
  const editable = course.status === "draft" || course.status === "published";

  return (
    <>
      <Helmet>
        <title>{`${course.title} - Live course - Testkart`}</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <Link to={teacherLiveCoursesPath} className={styles.back}>
          <ArrowLeft size={14} /> Live courses
        </Link>
        <ConsolePageHeader title={course.title}>
          <span className={`${styles.chip} ${styles[`tone_${status.tone}`]}`}>{status.label}</span>
          {course.status !== "draft" && (
            <Button variant="outline" asChild>
              <a href={liveCoursePath(course.slug)} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> View page
              </a>
            </Button>
          )}
          {course.status === "draft" && (
            <Button onClick={() => setConfirm("publish")}>
              <Send size={14} /> Publish
            </Button>
          )}
          {course.status === "published" && course.enrolledCount === 0 && (
            <Button variant="outline" onClick={() => setConfirm("unpublish")}>
              <Undo2 size={14} /> Back to draft
            </Button>
          )}
        </ConsolePageHeader>

        {course.status === "cancelled" && (
          <p className={styles.banner}>This course was cancelled{course.cancellationReason ? `: ${course.cancellationReason}` : "."}</p>
        )}

        <SegmentedControl
          aria-label="Course sections"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "details", label: "Details" },
            { value: "syllabus", label: "Syllabus" },
            { value: "schedule", label: `Classes (${course.classCount})` },
            { value: "students", label: `Students (${course.enrolledCount})` },
          ]}
        />

        {tab === "details" &&
          (editable ? (
            <LiveCourseDetailsForm
              course={course}
              pending={upsert.isPending}
              submitLabel="Save details"
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
        {tab === "schedule" && <LiveCourseSchedule course={course} refundClosesAt={data.refundClosesAt} mode="teacher" />}
        {tab === "students" && <LiveCourseStudents roster={students.data} loading={students.isLoading} canMark />}
      </div>

      <ConsoleConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "publish" ? "Publish this live course?" : "Move back to draft?"}
        description={
          confirm === "publish"
            ? "It goes on sale straight away at its own page. Students can buy until the registration deadline or until seats run out."
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
