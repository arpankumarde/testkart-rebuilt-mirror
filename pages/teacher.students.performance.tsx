import React from "react";
import { Helmet } from "react-helmet";
import { RefreshCw } from "lucide-react";
import { useIsFetching } from "@tanstack/react-query";
import { useAuth } from "../helpers/useAuth";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { TEACHER_PERFORMANCE_QUERY_KEY, useRefreshTeacherPerformance } from "../helpers/useTeacherPerformance";
import type { PerformanceTab } from "../helpers/teacherPerformanceFormat";
import { Button } from "../components/Button";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { TeacherPerformanceStudents, PerformanceToolbarTabs } from "../components/TeacherPerformanceStudents";
import { TeacherPerformanceLeaderboard } from "../components/TeacherPerformanceLeaderboard";
import { TeacherPerformanceCourses } from "../components/TeacherPerformanceCourses";
import { TeacherPerformanceNotes } from "../components/TeacherPerformanceNotes";
import { TeacherPerformanceStudentDialog } from "../components/TeacherPerformanceStudentDialog";
import styles from "./teacher.students.performance.module.css";

const TABS: readonly PerformanceTab[] = ["students", "leaderboards", "courses", "notes"];
const TAB_LABELS: Record<PerformanceTab, string> = {
  students: "Students",
  leaderboards: "Leaderboards",
  courses: "Course progress",
  notes: "Note reading",
};

const TeacherStudentPerformancePage: React.FC = () => {
  const { authState } = useAuth();
  const enabled = authState.type === "authenticated";
  const { read, readId, write } = useListUrlParams();
  const refresh = useRefreshTeacherPerformance();
  const fetching = useIsFetching({ queryKey: TEACHER_PERFORMANCE_QUERY_KEY }) > 0;

  const tab = read<PerformanceTab>("tab", TABS, "students");
  const seriesId = readId("series") ?? undefined;
  const itemId = readId("item") ?? undefined;
  const liveTestId = readId("live") ?? undefined;
  const courseId = readId("course") ?? undefined;
  const noteId = readId("note") ?? undefined;
  const studentId = readId("student");

  const toolbar: PerformanceToolbarTabs = {
    tabs: TABS.map((value) => ({ value, label: TAB_LABELS[value] })),
    value: tab,
    // A tab's picks belong to that tab, so switching starts it fresh.
    onValueChange: (value) =>
      write({ tab: value === "students" ? null : value, series: null, item: null, live: null, course: null, note: null }),
    tabsLabel: "Performance sections",
  };

  const openStudent = (id: number) => write({ student: id });

  return (
    <>
      <Helmet>
        <title>Student performance - Testkart for Teachers</title>
        <meta name="description" content="Scores, leaderboards, course progress and note reading for your students." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Student performance">
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => refresh()}
            disabled={fetching}
            aria-label="Refresh"
            className={styles.refresh}
          >
            <RefreshCw size={16} className={fetching ? styles.spin : undefined} />
          </Button>
        </ConsolePageHeader>

        {tab === "students" && (
          <TeacherPerformanceStudents
            toolbar={toolbar}
            scope={
              seriesId
                ? { seriesId }
                : liveTestId
                  ? { liveTestId }
                  : courseId
                    ? { courseId }
                    : noteId
                      ? { productId: noteId }
                      : {}
            }
            onClearScope={() => write({ series: null, live: null, course: null, note: null })}
            onOpenStudent={openStudent}
            enabled={enabled}
          />
        )}
        {tab === "leaderboards" && (
          <TeacherPerformanceLeaderboard
            toolbar={toolbar}
            selection={liveTestId ? { liveTestId } : seriesId ? { seriesId, itemId } : {}}
            onSelect={(next) =>
              write({ series: next.seriesId ?? null, item: next.itemId ?? null, live: next.liveTestId ?? null })
            }
            onOpenStudent={openStudent}
            enabled={enabled}
          />
        )}
        {tab === "courses" && (
          <TeacherPerformanceCourses
            toolbar={toolbar}
            courseId={courseId ?? null}
            onSelect={(id) => write({ course: id })}
            onOpenStudent={openStudent}
            enabled={enabled}
          />
        )}
        {tab === "notes" && (
          <TeacherPerformanceNotes
            toolbar={toolbar}
            productId={noteId ?? null}
            onSelect={(id) => write({ note: id })}
            onOpenStudent={openStudent}
            enabled={enabled}
          />
        )}

        <TeacherPerformanceStudentDialog studentId={studentId} onClose={() => write({ student: null })} />
      </div>
    </>
  );
};

export default TeacherStudentPerformancePage;
