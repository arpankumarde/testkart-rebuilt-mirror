import React, { useMemo, useState } from "react";
import { BookOpenCheck, Download } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { SegmentedControl } from "./SegmentedControl";
import { ConsoleListToolbar } from "./ConsoleListToolbar";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { perfStyles as styles, StudentName, ProgressBar, PerformanceFacts } from "./TeacherPerformanceKit";
import type { PerformanceToolbarTabs } from "./TeacherPerformanceStudents";
import { useTeacherPerformanceCourse } from "../helpers/useTeacherPerformance";
import { adminFormat } from "../helpers/adminFormat";
import { dateText, downloadCsv, scoreText } from "../helpers/teacherPerformanceFormat";
import type { CourseProgressStatus } from "../endpoints/teacher/performance/course_GET.schema";

type Props = {
  toolbar: PerformanceToolbarTabs;
  courseId: number | null;
  onSelect: (courseId: number) => void;
  onOpenStudent: (studentId: number) => void;
  enabled: boolean;
};

type StatusFilter = "all" | CourseProgressStatus;

const STATUS_LABELS: Record<CourseProgressStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_VARIANT: Record<CourseProgressStatus, "secondary" | "warning" | "success"> = {
  not_started: "secondary",
  in_progress: "warning",
  completed: "success",
};

export const TeacherPerformanceCourses = ({ toolbar, courseId, onSelect, onOpenStudent, enabled }: Props) => {
  const { data, isFetching, isError, error } = useTeacherPerformanceCourse(courseId, enabled);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const course = data?.course ?? null;

  const counts = useMemo(() => {
    const base = { all: 0, not_started: 0, in_progress: 0, completed: 0 };
    for (const row of course?.rows ?? []) {
      base.all += 1;
      base[row.status] += 1;
    }
    return base;
  }, [course]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (course?.rows ?? []).filter(
      (row) => (status === "all" || row.status === status) && (!term || row.name.toLowerCase().includes(term))
    );
  }, [course, search, status]);

  const exportCsv = () => {
    if (!course) return;
    downloadCsv(
      `course-progress-${course.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40)}`,
      rows.map((row) => ({
        Student: row.name,
        "Progress (%)": row.progress,
        "Lessons done": row.lessonsDone,
        "Lessons in course": row.lessonsTotal,
        Status: STATUS_LABELS[row.status],
        "Last lesson": dateText(row.lastLessonAt),
        "Enrolled on": dateText(row.enrolledAt),
      }))
    );
  };

  const toolbarBand = (
    <ConsoleListToolbar
      {...toolbar}
      search={
        course && course.rows.length > 0
          ? { value: search, onChange: setSearch, placeholder: "Find a student", label: "Find a student in this course" }
          : undefined
      }
    >
      <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
        <Download size={16} />
        Export CSV
      </Button>
    </ConsoleListToolbar>
  );

  if (isError && !data) {
    return (
      <div className={styles.stack}>
        {toolbarBand}
        <ConsoleListEmpty
          tone="error"
          icon={<BookOpenCheck size={22} />}
          title="Course progress could not be loaded"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.stack} aria-busy="true">
        {toolbarBand}
        <Skeleton style={{ height: "20rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className={styles.stack}>
        {toolbarBand}
        <ConsoleListEmpty
          icon={<BookOpenCheck size={22} />}
          title="No courses yet"
          description="Once students enrol in one of your courses, you can follow their progress lesson by lesson here."
        />
      </div>
    );
  }

  const statusOptions = (["all", "not_started", "in_progress", "completed"] as const).map((value) => ({
    value,
    label: `${value === "all" ? "All" : STATUS_LABELS[value]} (${counts[value]})`,
  }));

  return (
    <div className={styles.stack}>
      {toolbarBand}

      <section className={`${styles.panel} ${isFetching ? styles.busy : ""}`} aria-busy={isFetching} aria-label="Course progress">
        <div className={styles.panelHeader}>
          <Select
            value={String(course.id)}
            onValueChange={(value) => {
              setSearch("");
              setStatus("all");
              onSelect(Number(value));
            }}
          >
            <SelectTrigger className={styles.picker} aria-label="Course">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.courses.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.title} ({c.enrolled} enrolled)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {course.rows.length > 0 && (
            <SegmentedControl value={status} onValueChange={setStatus} options={statusOptions} aria-label="Progress status" />
          )}
        </div>

        <PerformanceFacts
          flat
          items={[
            { label: "Enrolled", value: adminFormat.count(course.totals.enrolled) },
            { label: "Started", value: adminFormat.count(course.totals.started) },
            { label: "Completed", value: adminFormat.count(course.totals.completed) },
            {
              label: "Average progress",
              value: scoreText(course.totals.averageProgress),
              note: `${adminFormat.count(course.lessons)} lessons in the course`,
            },
          ]}
        />

        {course.rows.length === 0 ? (
          <p className={styles.empty}>No one has enrolled in this course yet.</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>No student matches these filters.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Progress</th>
                <th>Status</th>
                <th className={styles.num}>Last lesson</th>
                <th className={styles.num}>Enrolled on</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <td>
                    <StudentName name={row.name} avatarUrl={row.avatarUrl} onOpen={() => onOpenStudent(row.studentId)} />
                  </td>
                  <td>
                    <ProgressBar value={row.progress} caption={`${row.lessonsDone} of ${row.lessonsTotal} lessons`} />
                  </td>
                  <td>
                    <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                  </td>
                  <td className={styles.num}>
                    {row.lastLessonAt ? (
                      <span title={dateText(row.lastLessonAt)}>{adminFormat.relativeTime(row.lastLessonAt)}</span>
                    ) : (
                      <span className={styles.none}>-</span>
                    )}
                  </td>
                  <td className={styles.num}>{dateText(row.enrolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className={styles.footnote}>
        Progress counts the lessons a student has marked done against the lessons the course has today, so adding lessons
        lowers everyone's percentage until they catch up.
      </p>
    </div>
  );
};
