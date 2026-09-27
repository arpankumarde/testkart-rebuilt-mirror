import React, { useMemo } from "react";
import { UserRound } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from "./ConsoleDialog";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import {
  perfStyles,
  ScoreBar,
  ProgressBar,
  RankBadge,
  PerformanceFacts,
  PerformanceFact,
  StudentPhoto,
  MarksCell,
  openRow,
  OpenCell,
  OpenHead,
} from "./TeacherPerformanceKit";
import { TeacherPerformanceTranscript } from "./TeacherPerformanceTranscript";
import { NOTE_STATUS } from "./TeacherPerformanceNotes";
import { useTeacherPerformanceStudent } from "../helpers/useTeacherPerformance";
import { adminFormat } from "../helpers/adminFormat";
import { dateText, scoreText } from "../helpers/teacherPerformanceFormat";
import type { StudentEnrolment, StudentPaperResult } from "../endpoints/teacher/performance/student_GET.schema";
import styles from "./TeacherPerformanceStudentDialog.module.css";

export type OpenPaper = { itemId: number; attemptId: number | null };

type Props = {
  studentId: number | null;
  paper: OpenPaper | null;
  onOpenPaper: (paper: OpenPaper | null) => void;
  onClose: () => void;
};

const ENROLMENT_LABELS: Record<StudentEnrolment["kind"], string> = {
  test_series: "Test series",
  course: "Course",
  live_test: "Live test",
  bundle: "Bundle",
  study_notes: "Study notes",
};

const COURSE_STATUS: Record<string, { label: string; variant: "secondary" | "warning" | "success" }> = {
  not_started: { label: "Not started", variant: "secondary" },
  in_progress: { label: "In progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
};

const LIVE_STATUS: Record<string, string> = { upcoming: "Not started", live: "Live now", ended: "Did not submit in time" };

export const TeacherPerformanceStudentDialog = ({ studentId, paper, onOpenPaper, onClose }: Props) => {
  const { data, isFetching, isError, error } = useTeacherPerformanceStudent(studentId);
  const current = data && data.student.id === studentId ? data : undefined;

  const groups = useMemo(() => {
    const bySeries = new Map<number, { title: string; inTrash: boolean; papers: StudentPaperResult[] }>();
    for (const item of current?.papers ?? []) {
      const group = bySeries.get(item.seriesId) ?? { title: item.seriesTitle, inTrash: item.inTrash, papers: [] };
      group.papers.push(item);
      bySeries.set(item.seriesId, group);
    }
    return [...bySeries.entries()];
  }, [current]);

  const scored = (current?.papers ?? []).filter((p) => p.bestScore !== null);
  const average = scored.length ? scored.reduce((sum, p) => sum + (p.bestScore as number), 0) / scored.length : null;
  const ranked = (current?.liveTests ?? []).filter((l) => l.rank !== null);
  const bestLiveRank = ranked.length ? Math.min(...ranked.map((l) => l.rank as number)) : null;
  const startedCourses = (current?.courses ?? []).filter((c) => c.lessonsDone > 0);
  const courseAverage = startedCourses.length
    ? startedCourses.reduce((sum, c) => sum + c.progress, 0) / startedCourses.length
    : null;
  const notesRead = (current?.notes ?? []).filter((n) => n.pagesRead > 0);
  const noteAverage = notesRead.length ? notesRead.reduce((sum, n) => sum + n.progress, 0) / notesRead.length : null;
  const anyRank = (current?.papers ?? []).some((p) => p.rank !== null);

  // Only figures with something behind them.
  const facts: PerformanceFact[] = [];
  if (current) {
    if (current.papers.length > 0) {
      facts.push({ label: "Papers finished", value: `${scored.length} of ${current.papers.length}` });
    }
    if (average !== null) facts.push({ label: "Average score", value: scoreText(average) });
    if (bestLiveRank !== null) facts.push({ label: "Best live test rank", value: `#${bestLiveRank}` });
    if (courseAverage !== null) facts.push({ label: "Course progress", value: scoreText(courseAverage) });
    if (noteAverage !== null) facts.push({ label: "Notes read", value: scoreText(noteAverage) });
  }

  const openPaperRank = paper
    ? (() => {
        const match = current?.papers.find((p) => p.itemId === paper.itemId);
        return match?.rank && match.rankedOf ? { rank: match.rank, of: match.rankedOf } : null;
      })()
    : null;

  return (
    <Dialog open={studentId !== null} onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="xl">
        <ConsoleDialogHeader
          icon={
            current ? (
              <StudentPhoto name={current.student.name} url={current.student.avatarUrl} large />
            ) : (
              <UserRound size={18} />
            )
          }
          title={current?.student.name ?? "Student results"}
          description={
            current
              ? `Enrolled in ${current.enrolments.length} ${current.enrolments.length === 1 ? "item" : "items"} of yours`
              : "Loading their results"
          }
        />
        <ConsoleDialogBody>
          {studentId !== null && paper ? (
            <TeacherPerformanceTranscript
              studentId={studentId}
              itemId={paper.itemId}
              attemptId={paper.attemptId}
              rank={openPaperRank}
              onSelectAttempt={(attemptId) => onOpenPaper({ itemId: paper.itemId, attemptId })}
              onBack={() => onOpenPaper(null)}
              backLabel="All results"
            />
          ) : isError && !current ? (
            <div className={perfStyles.error} role="alert">
              {error instanceof Error ? error.message : "Their results could not be loaded."}
            </div>
          ) : !current ? (
            <div className={styles.loading} aria-busy="true">
              <Skeleton style={{ height: "5.5rem", width: "100%", borderRadius: "var(--radius-md)" }} />
              <Skeleton style={{ height: "12rem", width: "100%", borderRadius: "var(--radius-md)" }} />
            </div>
          ) : (
            <div className={`${styles.sections} ${isFetching ? perfStyles.busy : ""}`}>
              {facts.length > 0 && <PerformanceFacts items={facts} />}

              {groups.length > 0 && (
                <section className={styles.section} aria-labelledby="perf-papers">
                  <h3 id="perf-papers" className={styles.sectionTitle}>
                    Test papers
                  </h3>
                  <div className={perfStyles.panel}>
                    <table className={perfStyles.table}>
                      <thead>
                        <tr>
                          <th>Paper</th>
                          <th className={perfStyles.num}>Marks</th>
                          <th>Score</th>
                          {anyRank && <th className={perfStyles.num}>Rank</th>}
                          <th className={perfStyles.num}>Attempts</th>
                          <th className={perfStyles.num}>Last attempt</th>
                          <OpenHead />
                        </tr>
                      </thead>
                      {groups.map(([seriesId, group]) => (
                        <tbody key={seriesId}>
                          {groups.length > 1 || group.inTrash ? (
                            <tr className={styles.groupRow}>
                              <th colSpan={anyRank ? 7 : 6} scope="colgroup">
                                {group.title}
                                {group.inTrash && <span className={perfStyles.tag}>In Trash</span>}
                              </th>
                            </tr>
                          ) : null}
                          {group.papers.map((item) => {
                            const open = () => onOpenPaper({ itemId: item.itemId, attemptId: null });
                            return (
                              <tr key={item.itemId} {...openRow(open)}>
                                <td className={styles.paperCell}>
                                  {item.paperTitle}
                                  {item.removed && <span className={perfStyles.tag}>Removed</span>}
                                </td>
                                <td className={perfStyles.num}>
                                  <MarksCell marks={item.bestMarks} max={item.maxMarks} />
                                </td>
                                <td>
                                  <ScoreBar value={item.bestScore} />
                                </td>
                                {anyRank && (
                                  <td className={perfStyles.num}>
                                    {item.rank ? (
                                      <>
                                        {item.rank}
                                        <span className={perfStyles.muted}> of {item.rankedOf}</span>
                                      </>
                                    ) : (
                                      <span className={perfStyles.none}>-</span>
                                    )}
                                  </td>
                                )}
                                <td className={perfStyles.num}>
                                  {item.attempts}
                                  {item.finished < item.attempts && (
                                    <span className={perfStyles.muted}> ({item.finished} submitted)</span>
                                  )}
                                </td>
                                <td className={perfStyles.num}>{dateText(item.lastAttemptAt)}</td>
                                <OpenCell label={`Open answers for ${item.paperTitle}`} onOpen={open} />
                              </tr>
                            );
                          })}
                        </tbody>
                      ))}
                    </table>
                  </div>
                </section>
              )}

              {current.liveTests.length > 0 && (
                <section className={styles.section} aria-labelledby="perf-live">
                  <h3 id="perf-live" className={styles.sectionTitle}>
                    Live tests
                  </h3>
                  <div className={perfStyles.panel}>
                    <table className={perfStyles.table}>
                      <thead>
                        <tr>
                          <th className={perfStyles.rankCol}>Rank</th>
                          <th>Live test</th>
                          <th className={perfStyles.num}>Marks</th>
                          <th>Score</th>
                          <th className={perfStyles.num}>Held on</th>
                          <OpenHead />
                        </tr>
                      </thead>
                      <tbody>
                        {current.liveTests.map((live) => {
                          const open =
                            live.itemId !== null && live.attemptId !== null
                              ? () => onOpenPaper({ itemId: live.itemId as number, attemptId: live.attemptId })
                              : null;
                          return (
                            <tr key={live.liveTestId} {...openRow(open)}>
                              <td>
                                <RankBadge rank={live.rank} />
                              </td>
                              <td className={styles.paperCell}>
                                {live.title}
                                <span className={perfStyles.muted}>
                                  {" "}
                                  {live.rank ? `of ${live.rankedOf}` : `- ${LIVE_STATUS[live.status]}`}
                                </span>
                              </td>
                              <td className={perfStyles.num}>
                                <MarksCell marks={live.marks} max={live.maxMarks} />
                              </td>
                              <td>
                                <ScoreBar value={live.score} />
                              </td>
                              <td className={perfStyles.num}>{dateText(live.startTime ?? live.endTime)}</td>
                              <OpenCell label={`Open answers for ${live.title}`} onOpen={open} />
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {current.courses.length > 0 && (
                <section className={styles.section} aria-labelledby="perf-courses">
                  <h3 id="perf-courses" className={styles.sectionTitle}>
                    Courses
                  </h3>
                  <div className={perfStyles.panel}>
                    <table className={perfStyles.table}>
                      <thead>
                        <tr>
                          <th>Course</th>
                          <th>Progress</th>
                          <th>Status</th>
                          <th className={perfStyles.num}>Last lesson</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.courses.map((course) => (
                          <tr key={course.courseId}>
                            <td className={styles.paperCell}>{course.title}</td>
                            <td>
                              {course.lessonsDone > 0 ? (
                                <ProgressBar
                                  value={course.progress}
                                  caption={`${course.lessonsDone} of ${course.lessonsTotal} lessons`}
                                />
                              ) : (
                                <span className={perfStyles.none}>-</span>
                              )}
                            </td>
                            <td>
                              <Badge variant={COURSE_STATUS[course.status].variant}>{COURSE_STATUS[course.status].label}</Badge>
                            </td>
                            <td className={perfStyles.num}>{dateText(course.lastLessonAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {current.notes.length > 0 && (
                <section className={styles.section} aria-labelledby="perf-notes">
                  <h3 id="perf-notes" className={styles.sectionTitle}>
                    Notes and PDFs
                  </h3>
                  <div className={perfStyles.panel}>
                    <table className={perfStyles.table}>
                      <thead>
                        <tr>
                          <th>Notes</th>
                          <th>Pages read</th>
                          <th>Status</th>
                          <th className={perfStyles.num}>Last opened</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.notes.map((note) => (
                          <tr key={note.productId}>
                            <td className={styles.paperCell}>{note.title}</td>
                            <td>
                              {note.pagesRead === 0 ? (
                                <span className={perfStyles.none}>-</span>
                              ) : note.pagesTotal > 0 ? (
                                <ProgressBar value={note.progress} caption={`${note.pagesRead} of ${note.pagesTotal} pages`} />
                              ) : (
                                `${note.pagesRead} pages`
                              )}
                            </td>
                            <td>
                              <Badge variant={NOTE_STATUS[note.status].variant}>{NOTE_STATUS[note.status].label}</Badge>
                            </td>
                            <td className={perfStyles.num}>{dateText(note.lastOpenedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {current.enrolments.length > 0 && (
                <section className={styles.section} aria-labelledby="perf-enrolments">
                  <h3 id="perf-enrolments" className={styles.sectionTitle}>
                    Enrolled in
                  </h3>
                  <ul className={styles.enrolments}>
                    {current.enrolments.map((item, index) => (
                      <li key={`${item.kind}-${index}`} className={styles.enrolment}>
                        <Badge variant="outline">{ENROLMENT_LABELS[item.kind]}</Badge>
                        <span className={styles.enrolmentTitle}>{item.title}</span>
                        <span className={styles.enrolmentDate}>{dateText(item.enrolledAt)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {current.papers.length === 0 && current.liveTests.length === 0 && (
                <p className={styles.empty}>Has not attempted any of your tests yet.</p>
              )}
            </div>
          )}
        </ConsoleDialogBody>
      </ConsoleDialogContent>
    </Dialog>
  );
};
