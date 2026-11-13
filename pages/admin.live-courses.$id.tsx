import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, History, OctagonX } from "lucide-react";
import { useAdminLiveCourseActionMutation, useAdminLiveCourseQuery } from "../helpers/useLiveCourses";
import type { LiveCourseClass } from "../helpers/liveCourseData";
import { formatRupees, liveCoursePath } from "../helpers/liveCourseRules";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { SegmentedControl } from "../components/SegmentedControl";
import { LiveCourseDetailsForm, LiveCourseSchedule, LiveCourseStudents, LiveCourseSyllabusEditor } from "../components/LiveCourseEditor";
import { AdminPriceHistorySheet } from "../components/AdminPriceHistorySheet";
import styles from "./admin.live-courses.$id.module.css";

type Tab = "details" | "syllabus" | "classes" | "students";
type Pending =
  | { kind: "cancel_course" }
  | { kind: "cancel_class"; cls: LiveCourseClass }
  | { kind: "refund"; enrollmentId: string; name: string };

const AdminLiveCoursePage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, error } = useAdminLiveCourseQuery(id);
  const action = useAdminLiveCourseActionMutation();
  const [tab, setTab] = useState<Tab>("details");
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  if (isLoading) return <Skeleton style={{ height: "20rem" }} />;
  if (!data) return <p className={styles.error}>{error instanceof Error ? error.message : "Live course not found."}</p>;

  const course = data.course;
  const closeDialog = () => {
    setPending(null);
    setReason("");
  };
  const run = (input: Parameters<typeof action.mutate>[0]) =>
    action.mutate(input, {
      onSuccess: (r) => {
        toast.success(r.message);
        closeDialog();
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed."),
    });

  return (
    <>
      <Helmet>
        <title>{`${course.title} - Live course - Testkart Admin`}</title>
      </Helmet>
      <div className={styles.page}>
        <Link to="/admin/live-lessons/courses" className={styles.back}>
          <ArrowLeft size={14} /> Live courses
        </Link>
        <ConsolePageHeader title={course.title} description={`${course.teacher.name} · ${course.status} · ${course.enrolledCount}/${course.seatLimit} seats · ${formatRupees(course.price)}`}>
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History size={14} /> Price history
          </Button>
          {course.status !== "draft" && (
            <Button variant="outline" asChild>
              <a href={liveCoursePath(course.slug)} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> View page
              </a>
            </Button>
          )}
          {(course.status === "published" || course.status === "draft") && (
            <Button variant="destructive" onClick={() => setPending({ kind: "cancel_course" })}>
              <OctagonX size={14} /> Cancel course
            </Button>
          )}
        </ConsolePageHeader>

        {course.status === "cancelled" && course.cancellationReason && <p className={styles.banner}>Cancelled: {course.cancellationReason}</p>}

        <SegmentedControl
          aria-label="Course sections"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "details", label: "Details" },
            { value: "syllabus", label: "Syllabus" },
            { value: "classes", label: `Classes (${course.classCount})` },
            { value: "students", label: `Students (${course.enrolledCount})` },
          ]}
        />

        {tab === "details" && (
          <LiveCourseDetailsForm
            course={course}
            pending={action.isPending}
            submitLabel="Save details"
            onSubmit={(details) =>
              action.mutate(
                { action: "update", courseId: course.id, details },
                {
                  onSuccess: (r) => toast.success(r.message),
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
                }
              )
            }
          />
        )}
        {tab === "syllabus" && <LiveCourseSyllabusEditor course={course} readOnly />}
        {tab === "classes" && (
          <LiveCourseSchedule
            course={course}
            refundClosesAt={data.refundClosesAt}
            mode="admin"
            onAdminCancel={(cls) => setPending({ kind: "cancel_class", cls })}
          />
        )}
        {tab === "students" && (
          <LiveCourseStudents
            roster={data.roster}
            loading={false}
            canMark={false}
            onRefund={(enrollmentId, name) => setPending({ kind: "refund", enrollmentId, name })}
          />
        )}
      </div>

      <ConsoleConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && closeDialog()}
        tone="destructive"
        title={
          pending?.kind === "cancel_course"
            ? "Cancel the whole course?"
            : pending?.kind === "cancel_class"
              ? `Cancel "${pending.cls.title}"?`
              : `Refund ${pending?.kind === "refund" ? pending.name : ""}?`
        }
        description={
          pending?.kind === "cancel_course"
            ? `Every upcoming class is cancelled and all ${course.enrolledCount} enrolled students get a full refund through Cashfree. This cannot be undone.`
            : pending?.kind === "cancel_class"
              ? "Enrolled students are told by email and WhatsApp."
              : "The full amount goes back through Cashfree and the student loses their seat, whatever the refund window says."
        }
        confirmLabel={pending?.kind === "cancel_course" ? "Cancel and refund all" : pending?.kind === "cancel_class" ? "Cancel class" : "Refund"}
        pendingLabel="Working..."
        isPending={action.isPending}
        note={{ label: pending?.kind === "refund" ? "Note to the student (optional)" : "Reason", value: reason, onChange: setReason, required: pending?.kind !== "refund" }}
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === "cancel_course") run({ action: "cancel_course", courseId: course.id, reason: reason.trim() });
          else if (pending.kind === "cancel_class") run({ action: "cancel_class", classId: pending.cls.id, reason: reason.trim() });
          else run({ action: "refund", enrollmentId: pending.enrollmentId, reason: reason.trim() || undefined });
        }}
      />

      <AdminPriceHistorySheet
        target={historyOpen ? { productType: "live_course", productId: String(course.id) } : null}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
};

export default AdminLiveCoursePage;
