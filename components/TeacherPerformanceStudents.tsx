import React, { useMemo, useState } from "react";
import { Download, Users } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ConsoleListToolbar, ConsoleListTab, consoleToolbarControlClass } from "./ConsoleListToolbar";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { ConsoleFilterNotice } from "./ConsoleFilterNotice";
import { ConsoleListPagination } from "./ConsoleListPagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import {
  perfStyles as styles,
  StudentName,
  ScoreBar,
  ProgressBar,
  SortHeader,
  ariaSort,
  PerformanceFacts,
  PerformanceFact,
} from "./TeacherPerformanceKit";
import { useTeacherPerformanceStudents } from "../helpers/useTeacherPerformance";
import { adminFormat } from "../helpers/adminFormat";
import {
  compareNullable,
  dateText,
  downloadCsv,
  scoreText,
  SortDirection,
} from "../helpers/teacherPerformanceFormat";
import type { PerformanceStudentRow } from "../endpoints/teacher/performance/students_GET.schema";

export type PerformanceToolbarTabs = {
  tabs: ConsoleListTab[];
  value: string;
  onValueChange: (value: string) => void;
  tabsLabel: string;
};

type Props = {
  toolbar: PerformanceToolbarTabs;
  scope: { seriesId?: number; liveTestId?: number; courseId?: number; productId?: number };
  onClearScope: () => void;
  onOpenStudent: (studentId: number) => void;
  enabled: boolean;
};

const SHOW_VALUES = ["all", "tests", "courses", "notes", "inactive"] as const;
type Show = (typeof SHOW_VALUES)[number];
const SHOW_LABELS: Record<Show, string> = {
  all: "All students",
  tests: "Took a test",
  courses: "Learning a course",
  notes: "Bought notes",
  inactive: "No activity yet",
};

type SortKey =
  | "name"
  | "enrolments"
  | "papersFinished"
  | "averageScore"
  | "bestScore"
  | "courseProgress"
  | "noteProgress"
  | "lastActiveAt";

const SCOPE_LABELS = { series: "Test series", live_test: "Live test", course: "Course", note: "Notes" } as const;

const PAGE_SIZE = 25;

const sortValue = (row: PerformanceStudentRow, key: SortKey): number | string | null => {
  switch (key) {
    case "name":
      return row.name;
    case "lastActiveAt":
      return row.lastActiveAt ? new Date(row.lastActiveAt).getTime() : null;
    case "courseProgress":
      return row.courses > 0 ? row.courseProgress ?? 0 : null;
    case "noteProgress":
      return row.notes > 0 ? row.noteProgress ?? 0 : null;
    default:
      return row[key];
  }
};

export const TeacherPerformanceStudents = ({ toolbar, scope, onClearScope, onOpenStudent, enabled }: Props) => {
  const { data, isFetching, isError, error } = useTeacherPerformanceStudents(scope, enabled);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "lastActiveAt", direction: "desc" });
  const [page, setPage] = useState(1);

  const scopeKind = data?.scope?.kind ?? null;
  const totals = data?.totals;
  const showTests = scopeKind !== "course" && scopeKind !== "note";
  // On the full roster a column only shows once some student has something in it.
  const showCourses = scopeKind === "course" || (scopeKind === null && (totals?.courseLearners ?? 0) > 0);
  const showNotes = scopeKind === "note" || (scopeKind === null && (totals?.noteOwners ?? 0) > 0);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.students
      .filter((row) => !term || row.name.toLowerCase().includes(term))
      .filter((row) => {
        if (show === "tests") return row.papersStarted > 0;
        if (show === "courses") return row.courses > 0;
        if (show === "notes") return row.notes > 0;
        if (show === "inactive") return row.lastActiveAt === null;
        return true;
      })
      .sort(
        (a, b) =>
          compareNullable(sortValue(a, sort.key), sortValue(b, sort.key), sort.direction) ||
          a.name.localeCompare(b.name)
      );
  }, [data, search, show, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    setPage(1);
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: key === "name" ? "asc" : "desc" }
    );
  };

  const header = (key: SortKey, label: string, numeric = false) => (
    <th aria-sort={ariaSort(sort.key === key, sort.direction)} className={numeric ? styles.num : undefined}>
      <SortHeader label={label} active={sort.key === key} direction={sort.direction} onSort={() => toggleSort(key)} />
    </th>
  );

  const exportCsv = () => {
    downloadCsv(
      "student-performance",
      rows.map((row) => ({
        Student: row.name,
        "Enrolled in": row.enrolments,
        ...(showTests && {
          "Papers started": row.papersStarted,
          "Papers finished": row.papersFinished,
          "Average score (%)": row.averageScore ?? "",
          "Best score (%)": row.bestScore ?? "",
        }),
        ...(showCourses && {
          Courses: row.courses,
          "Lessons done": row.lessonsDone,
          "Course progress (%)": row.courses > 0 ? row.courseProgress ?? 0 : "",
        }),
        ...(showNotes && {
          Notes: row.notes,
          "Note pages read": row.notePagesRead,
          "Notes read (%)": row.notes > 0 ? row.noteProgress ?? 0 : "",
        }),
        "First enrolled": dateText(row.firstEnrolledAt),
        "Last active": dateText(row.lastActiveAt),
      }))
    );
  };

  const toolbarBand = (
    <ConsoleListToolbar
      {...toolbar}
      search={{
        value: search,
        onChange: (value) => {
          setSearch(value);
          setPage(1);
        },
        placeholder: "Search students",
        label: "Search students by name",
      }}
    >
      <Select
        value={show}
        onValueChange={(value) => {
          setShow(value as Show);
          setPage(1);
        }}
      >
        <SelectTrigger className={consoleToolbarControlClass} aria-label="Show">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SHOW_VALUES.filter((value) =>
            value === "tests" ? showTests : value === "courses" ? showCourses : value === "notes" ? showNotes : true
          ).map((value) => (
            <SelectItem key={value} value={value}>
              {SHOW_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
          icon={<Users size={22} />}
          title="Student results could not be loaded"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        >
          {(scope.seriesId || scope.liveTestId || scope.courseId || scope.productId) && (
            <Button variant="outline" onClick={onClearScope}>
              Show all students
            </Button>
          )}
        </ConsoleListEmpty>
      </div>
    );
  }

  const scopeLabel = data?.scope && `${SCOPE_LABELS[data.scope.kind]}: ${data.scope.title}`;

  const facts = (): PerformanceFact[] => {
    if (!data || !totals) return [];
    const students = { label: "Students", value: adminFormat.count(totals.students) };
    if (scopeKind === "note") {
      return [
        students,
        { label: "Opened the notes", value: adminFormat.count(totals.noteReaders), note: "read at least one page" },
        { label: "Pages read", value: adminFormat.count(data.students.reduce((sum, s) => sum + s.notePagesRead, 0)) },
        { label: "Average read", value: scoreText(totals.averageNoteProgress), note: "of those who opened them" },
      ];
    }
    if (scopeKind === "course") {
      return [
        students,
        { label: "Started the course", value: adminFormat.count(data.students.filter((s) => s.lessonsDone > 0).length) },
        { label: "Lessons done", value: adminFormat.count(data.students.reduce((sum, s) => sum + s.lessonsDone, 0)) },
        {
          label: "Course progress",
          value: scoreText(totals.averageProgress),
          note: `${adminFormat.count(totals.courseLearners)} in a course`,
        },
      ];
    }
    const testFacts: PerformanceFact[] = [
      students,
      {
        label: "Took a test",
        value: adminFormat.count(totals.testTakers),
        note: `${adminFormat.count(totals.papersFinished)} papers finished`,
      },
      { label: "Average score", value: scoreText(totals.averageScore), note: "best attempt on each paper" },
    ];
    if (showCourses) {
      return [
        ...testFacts,
        {
          label: "Course progress",
          value: scoreText(totals.averageProgress),
          note: `${adminFormat.count(totals.courseLearners)} in a course`,
        },
      ];
    }
    if (showNotes) {
      return [
        ...testFacts,
        {
          label: "Notes read",
          value: scoreText(totals.averageNoteProgress),
          note: `${adminFormat.count(totals.noteReaders)} of ${adminFormat.count(totals.noteOwners)} buyers opened them`,
        },
      ];
    }
    return [
      ...testFacts,
      {
        label: "Best score",
        value: scoreText(
          data.students.reduce<number | null>(
            (top, s) => (s.bestScore !== null && (top === null || s.bestScore > top) ? s.bestScore : top),
            null
          )
        ),
      },
    ];
  };

  return (
    <div className={styles.stack}>
      {totals ? (
        <PerformanceFacts busy={isFetching} items={facts()} />
      ) : (
        <Skeleton style={{ height: "5.5rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      )}

      {toolbarBand}

      {scopeLabel && <ConsoleFilterNotice label={scopeLabel} count={rows.length} onClear={onClearScope} clearLabel="Show all students" />}

      {!data ? (
        <Skeleton style={{ height: "20rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      ) : data.students.length === 0 ? (
        <ConsoleListEmpty
          icon={<Users size={22} />}
          title={data.scope ? "No students here yet" : "No students yet"}
          description="Students appear here once they enrol in, buy or attempt something of yours."
        />
      ) : rows.length === 0 ? (
        <ConsoleListEmpty icon={<Users size={22} />} title="No students match" description="Try another name or show all students.">
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setShow("all");
            }}
          >
            Clear filters
          </Button>
        </ConsoleListEmpty>
      ) : (
        <>
          <div className={`${styles.panel} ${isFetching ? styles.busy : ""}`} aria-busy={isFetching}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {header("name", "Student")}
                  {header("enrolments", "Enrolled in", true)}
                  {showTests && header("papersFinished", "Papers done", true)}
                  {showTests && header("averageScore", "Average score")}
                  {showTests && header("bestScore", "Best score")}
                  {showCourses && header("courseProgress", "Course progress")}
                  {showNotes && header("noteProgress", "Notes read")}
                  {header("lastActiveAt", "Last active")}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.studentId}>
                    <td>
                      <StudentName name={row.name} avatarUrl={row.avatarUrl} onOpen={() => onOpenStudent(row.studentId)} />
                    </td>
                    <td className={styles.num}>{adminFormat.count(row.enrolments)}</td>
                    {showTests && (
                      <td className={styles.num}>
                        {row.papersStarted === 0 ? (
                          <span className={styles.none}>-</span>
                        ) : (
                          <>
                            {row.papersFinished}
                            <span className={styles.muted}> of {row.papersStarted}</span>
                          </>
                        )}
                      </td>
                    )}
                    {showTests && (
                      <td>
                        <ScoreBar value={row.averageScore} />
                      </td>
                    )}
                    {showTests && <td className={styles.num}>{scoreText(row.bestScore)}</td>}
                    {showCourses && (
                      <td>
                        {row.courses > 0 ? (
                          <ProgressBar
                            value={row.courseProgress ?? 0}
                            caption={`${row.lessonsDone} lessons, ${row.courses} ${row.courses === 1 ? "course" : "courses"}`}
                          />
                        ) : (
                          <span className={styles.none}>-</span>
                        )}
                      </td>
                    )}
                    {showNotes && (
                      <td>
                        {row.notes > 0 ? (
                          <ProgressBar
                            value={row.noteProgress ?? 0}
                            caption={`${row.notePagesRead} pages, ${row.notes} ${row.notes === 1 ? "note" : "notes"}`}
                          />
                        ) : (
                          <span className={styles.none}>-</span>
                        )}
                      </td>
                    )}
                    <td className={styles.num}>
                      {row.lastActiveAt ? (
                        <span title={dateText(row.lastActiveAt)}>{adminFormat.relativeTime(row.lastActiveAt)}</span>
                      ) : (
                        <span className={styles.none}>Not yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <ConsoleListPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />}
          <p className={styles.footnote}>
            Scores are percentages from each student's best finished attempt on each paper. Notes read counts pages opened
            in the reader on the website. Last active is the last paper attempt, finished lesson or page read. Click a name
            for the full breakdown.
          </p>
        </>
      )}
    </div>
  );
};
