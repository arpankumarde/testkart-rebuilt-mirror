import React, { useMemo } from "react";
import { UserRound } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from "./ConsoleDialog";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { perfStyles, ScoreBar, ProgressBar, RankBadge, PerformanceFacts, StudentPhoto } from "./TeacherPerformanceKit";
import { NOTE_STATUS } from "./TeacherPerformanceNotes";
import { useTeacherPerformanceStudent } from "../helpers/useTeacherPerformance";
import { adminFormat } from "../helpers/adminFormat";
import { dateText, durationText, scoreText } from "../helpers/teacherPerformanceFormat";
import type { StudentEnrolment, StudentPaperResult } from "../endpoints/teacher/performance/student_GET.schema";
import styles from "./TeacherPerformanceStudentDialog.module.css";

type Props = { studentId: number | null; onClose: () => void };

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

const LIVE_STATUS: Record<string, string> = { upcoming: "Not started", live: "Live now", ended: "Ended" };

export const TeacherPerformanceStudentDialog = ({ studentId, onClose }: Props) => {
  const { data, isFetching, isError, error } = useTeacherPerformanceStudent(studentId);
  const current = data && data.student.id === studentId ? data : undefined;

  const groups = useMemo(() => {
    const bySeries = new Map<number, { title: string; inTrash: boolean; papers: StudentPaperResult[] }>();
    for (const paper of current?.papers ?? []) {
      const group = bySeries.get(paper.seriesId) ?? { title: paper.seriesTitle, inTrash: paper.inTrash, papers: [] };
      group.papers.push(paper);
      bySeries.set(paper.seriesId, group);
    }
    return [...bySeries.entries()];
  }, [current]);

  const scored = (current?.papers ?? []).filter((p) => p.bestScore !== null);
  const average = scored.length ? scored.reduce((sum, p) => sum + (p.bestScore as number), 0) / scored.length : null;
  const ranked = (current?.liveTests ?? []).filter((l) => l.rank !== null);
  const bestLiveRank = ranked.length ? Math.min(...ranked.map((l) => l.rank as number)) : null;
  const courseAverage = current?.courses.length
    ? current.courses.reduce((sum, c) => sum + c.progress, 0) / current.courses.length
    : null;
  const notesRead = (current?.notes ?? []).filter((n) => n.pagesRead > 0);
  const noteAverage = notesRead.length ? notesRead.reduce((sum, n) => sum + n.progress, 0) / notesRead.length : null;

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
              ? `Enrolled in ${current.enrolments.length} ${current.enrolments.length === 1 ? "item" : "items"} of yours. Scores are percentages.`
              : "Loading their results"
          }
        />
        <ConsoleDialogBody>
          {isError && !current ? (
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
              <PerformanceFacts
                items={[
                  {
                    label: "Papers finished",
                    value: adminFormat.count(scored.length),
                    note: `${adminFormat.count(current.papers.length)} opened`,
                  },
                  { label: "Average score", value: scoreText(average), note: "best attempt on each paper" },
                  // Live tests, courses and notes only take a slot when the student has some.
                  current.liveTests.length > 0
                    ? {
                        label: "Best live test rank",
                        value: bestLiveRank ? `#${bestLiveRank}` : "-",
                        note: `${adminFormat.count(current.liveTests.length)} live tests joined`,
                      }
                    : {
                        label: "Attempts",
                        value: adminFormat.count(current.papers.reduce((sum, p) => sum + p.attempts, 0)),
                        note: "every paper, finished or not",
                      },
                  current.courses.length > 0
                    ? {
                        label: "Course progress",
                        value: scoreText(courseAverage),
                        note: `${adminFormat.count(current.courses.length)} ${current.courses.length === 1 ? "course" : "courses"}`,
                      }
                    : current.notes.length > 0
                      ? {
                          label: "Notes read",
                          value: scoreText(noteAverage),
                          note: `${adminFormat.count(notesRead.length)} of ${adminFormat.count(current.notes.length)} opened`,
                        }
                      : {
                          label: "Last attempt",
                          value: dateText(
                            current.papers.reduce<Date | null>(
                              (latest, p) =>
                                p.lastAttemptAt && (!latest || new Date(p.lastAttemptAt) > latest)
                                  ? new Date(p.lastAttemptAt)
                                  : latest,
                              null
                            )
                          ),
                        },
                ]}
              />

              <section className={styles.section} aria-labelledby="perf-papers">
                <h3 id="perf-papers" className={styles.sectionTitle}>
                  Test papers
                </h3>
                {groups.length === 0 ? (
                  <p className={styles.empty}>Has not opened any of your test papers.</p>
                ) : (
                  <div className={perfStyles.panel}>
                    <table className={perfStyles.table}>
                      <thead>
                        <tr>
                          <th>Paper</th>
                          <th className={perfStyles.num}>Attempts</th>
                          <th className={perfStyles.num}>First</th>
                          <th>Best</th>
                          <th className={perfStyles.num}>Latest</th>
                          <th className={perfStyles.num}>Rank</th>
                          <th className={perfStyles.num}>Time</th>
                          <th className={perfStyles.num}>Last attempt</th>
                        </tr>
                      </thead>
                      {groups.map(([seriesId, group]) => (
                        <tbody key={seriesId}>
                          <tr className={styles.groupRow}>
                            <th colSpan={8} scope="colgroup">
                              {group.title}
                              {group.inTrash && <span className={perfStyles.tag}>In Trash</span>}
                            </th>
                          </tr>
                          {group.papers.map((paper) => (
                            <tr key={paper.itemId}>
                              <td>
                                {paper.paperTitle}
                                {paper.removed && <span className={perfStyles.tag}>Removed</span>}
                              </td>
                              <td className={perfStyles.num}>
                                {paper.attempts}
                                {paper.finished < paper.attempts && (
                                  <span className={perfStyles.muted}> ({paper.finished} finished)</span>
                                )}
                              </td>
                              <td className={perfStyles.num}>{scoreText(paper.firstScore)}</td>
                              <td>
                                <ScoreBar value={paper.bestScore} />
                              </td>
                              <td className={perfStyles.num}>{scoreText(paper.latestScore)}</td>
                              <td className={perfStyles.num}>
                                {paper.rank ? (
                                  <>
                                    {paper.rank}
                                    <span className={perfStyles.muted}> of {paper.rankedOf}</span>
                                  </>
                                ) : (
                                  <span className={perfStyles.none}>-</span>
                                )}
                              </td>
                              <td className={perfStyles.num}>{durationText(paper.timeTakenMinutes)}</td>
                              <td className={perfStyles.num}>{dateText(paper.lastAttemptAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      ))}
                    </table>
                  </div>
                )}
              </section>

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
                          <th>Score</th>
                          <th className={perfStyles.num}>Time</th>
                          <th className={perfStyles.num}>Held on</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.liveTests.map((live) => (
                          <tr key={live.liveTestId}>
                            <td>
                              <RankBadge rank={live.rank} />
                            </td>
                            <td>
                              {live.title}
                              <span className={perfStyles.muted}>
                                {" "}
                                {live.rank ? `of ${live.rankedOf}` : live.status === "ended" ? "- did not submit in time" : `- ${LIVE_STATUS[live.status]}`}
                              </span>
                            </td>
                            <td>
                              <ScoreBar value={live.score} />
                            </td>
                            <td className={perfStyles.num}>{durationText(live.timeTakenMinutes)}</td>
                            <td className={perfStyles.num}>{dateText(live.startTime ?? live.endTime)}</td>
                          </tr>
                        ))}
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
                            <td>{course.title}</td>
                            <td>
                              <ProgressBar
                                value={course.progress}
                                caption={`${course.lessonsDone} of ${course.lessonsTotal} lessons`}
                              />
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
                            <td>{note.title}</td>
                            <td>
                              {note.pagesTotal > 0 ? (
                                <ProgressBar value={note.progress} caption={`${note.pagesRead} of ${note.pagesTotal} pages`} />
                              ) : note.pagesRead > 0 ? (
                                `${note.pagesRead} pages`
                              ) : (
                                <span className={perfStyles.none}>-</span>
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
            </div>
          )}
        </ConsoleDialogBody>
      </ConsoleDialogContent>
    </Dialog>
  );
};
