import React, { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { MathMLContent } from "./MathMLContent";
import { TestResultQuestionRenderer } from "./TestResultQuestionRenderer";
import { perfStyles } from "./TeacherPerformanceKit";
import { useTeacherPerformanceAttempt } from "../helpers/useTeacherPerformance";
import { dateText, durationText, marksText, scoreText } from "../helpers/teacherPerformanceFormat";
import type { TranscriptQuestion, TranscriptStatus } from "../endpoints/teacher/performance/attempt_GET.schema";
import styles from "./TeacherPerformanceTranscript.module.css";

type Props = {
  studentId: number;
  itemId: number;
  attemptId: number | null;
  rank?: { rank: number; of: number } | null;
  onSelectAttempt: (attemptId: number) => void;
  onBack: () => void;
  backLabel: string;
};

type Filter = "all" | TranscriptStatus;

const STATUS_LABEL: Record<TranscriptStatus, string> = {
  correct: "Correct",
  wrong: "Wrong",
  partial: "Partly correct",
  skipped: "Skipped",
};

const FILTERS: Filter[] = ["all", "wrong", "skipped", "partial", "correct"];

/** The student's answer and the key, in a few characters, for the collapsed row. */
const answerSummary = (q: TranscriptQuestion): { given: string | null; key: string | null } => {
  switch (q.questionType) {
    case "multiple_correct_mcq":
      return {
        given: q.selectedOptions?.length ? [...q.selectedOptions].sort().join(", ") : null,
        key: q.correctOptions?.length ? [...q.correctOptions].sort().join(", ") : null,
      };
    case "numerical":
      return {
        given: q.studentNumericalAnswer === null ? null : String(q.studentNumericalAnswer),
        key: q.correctNumericalAnswer === null ? null : String(q.correctNumericalAnswer),
      };
    case "match_the_following":
      return { given: q.status === "skipped" ? null : "Matched", key: null };
    default:
      return { given: q.selectedOption, key: q.correctOption };
  }
};

const signed = (value: number) => (value > 0 ? `+${marksText(value)}` : marksText(value));

export const TeacherPerformanceTranscript = ({
  studentId,
  itemId,
  attemptId,
  rank,
  onSelectAttempt,
  onBack,
  backLabel,
}: Props) => {
  const { data, isFetching, isError, error } = useTeacherPerformanceAttempt(studentId, itemId, attemptId);
  const current =
    data && data.student.id === studentId && data.paper.itemId === itemId ? data : undefined;
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Set<number>>(new Set());

  const visible = useMemo(
    () => (current?.questions ?? []).filter((q) => filter === "all" || q.status === filter),
    [current, filter]
  );

  const toggle = (number: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });

  const jumpTo = (number: number) => {
    setFilter("all");
    setOpen((prev) => new Set(prev).add(number));
    requestAnimationFrame(() =>
      document.getElementById(`transcript-q-${number}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const back = (
    <button type="button" className={styles.back} onClick={onBack}>
      <ArrowLeft size={16} aria-hidden="true" />
      {backLabel}
    </button>
  );

  if (isError && !current) {
    return (
      <div className={styles.stack}>
        {back}
        <div className={perfStyles.error} role="alert">
          {error instanceof Error ? error.message : "These answers could not be loaded."}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={styles.stack} aria-busy="true">
        {back}
        <Skeleton style={{ height: "8rem", width: "100%", borderRadius: "var(--radius-md)" }} />
        <Skeleton style={{ height: "16rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  const { attempt, paper, attempts, subjects } = current;
  const { counts, marks } = attempt;
  const max = paper.maxMarks;
  const gainedWidth = max > 0 ? Math.min(100, (marks.gained / max) * 100) : 0;
  const lostWidth = max > 0 ? Math.min(100 - gainedWidth, (marks.lost / max) * 100) : 0;
  const filterCount = (f: Filter) => (f === "all" ? current.questions.length : counts[f]);

  return (
    <div className={`${styles.stack} ${isFetching ? perfStyles.busy : ""}`}>
      <div className={styles.head}>
        {back}
        <h3 className={styles.title}>{paper.title}</h3>
        <p className={styles.series}>{paper.seriesTitle}</p>
      </div>

      {attempts.length > 1 && (
        <div className={styles.attempts} role="tablist" aria-label="Attempts">
          {attempts.map((a) => (
            <button
              key={a.attemptId}
              type="button"
              role="tab"
              aria-selected={a.attemptId === attempt.attemptId}
              className={`${styles.attemptTab} ${a.attemptId === attempt.attemptId ? styles.attemptActive : ""}`}
              onClick={() => onSelectAttempt(a.attemptId)}
            >
              <span className={styles.attemptName}>
                Attempt {a.number}
                {a.isBest && <span className={styles.bestTag}>Best</span>}
              </span>
              <span className={styles.attemptScore}>{a.completedAt ? scoreText(a.score) : "Not submitted"}</span>
            </button>
          ))}
        </div>
      )}

      {!attempt.finished ? (
        <p className={styles.note}>This attempt was not submitted, so there are no answers to show.</p>
      ) : (
        <>
          <section className={styles.score} aria-label="Result">
            <div className={styles.scoreMain}>
              <span className={`${styles.net} ${marks.net < 0 ? styles.netNegative : ""}`}>{marksText(marks.net)}</span>
              <span className={styles.max}>/ {marksText(max)}</span>
              <span className={styles.percent}>{scoreText(attempt.score)}</span>
            </div>
            <div className={styles.split}>
              <div className={styles.splitTrack} aria-hidden="true">
                <span className={styles.splitGain} style={{ width: `${gainedWidth}%` }} />
                <span className={styles.splitLoss} style={{ width: `${lostWidth}%` }} />
              </div>
              <div className={styles.splitLegend}>
                <span className={styles.gain}>+{marksText(marks.gained)} earned</span>
                {marks.lost > 0 && <span className={styles.loss}>-{marksText(marks.lost)} negative marks</span>}
              </div>
            </div>
            <dl className={styles.counts}>
              <div>
                <dt>Correct</dt>
                <dd className={styles.gain}>{counts.correct}</dd>
              </div>
              <div>
                <dt>Wrong</dt>
                <dd className={counts.wrong > 0 ? styles.loss : undefined}>{counts.wrong}</dd>
              </div>
              {counts.partial > 0 && (
                <div>
                  <dt>Partly correct</dt>
                  <dd>{counts.partial}</dd>
                </div>
              )}
              {counts.skipped > 0 && (
                <div>
                  <dt>Skipped</dt>
                  <dd>{counts.skipped}</dd>
                </div>
              )}
              <div>
                <dt>Time</dt>
                <dd>{durationText(attempt.timeTakenMinutes)}</dd>
              </div>
              {rank && attempt.isBest && (
                <div>
                  <dt>Rank</dt>
                  <dd>
                    {rank.rank}
                    <span className={styles.of}> of {rank.of}</span>
                  </dd>
                </div>
              )}
              <div>
                <dt>Submitted</dt>
                <dd>{dateText(attempt.completedAt)}</dd>
              </div>
            </dl>
          </section>

          {subjects.length > 1 && (
            <div className={perfStyles.panel}>
              <table className={perfStyles.table}>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th className={perfStyles.num}>Marks</th>
                    <th className={perfStyles.num}>Correct</th>
                    <th className={perfStyles.num}>Wrong</th>
                    {counts.skipped > 0 && <th className={perfStyles.num}>Skipped</th>}
                    {marks.lost > 0 && <th className={perfStyles.num}>Negative</th>}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className={perfStyles.num}>
                        <strong>{marksText(s.net)}</strong>
                        <span className={perfStyles.muted}> / {marksText(s.maxMarks)}</span>
                      </td>
                      <td className={perfStyles.num}>{s.correct}</td>
                      <td className={perfStyles.num}>{s.wrong}</td>
                      {counts.skipped > 0 && <td className={perfStyles.num}>{s.skipped}</td>}
                      {marks.lost > 0 && (
                        <td className={`${perfStyles.num} ${s.lost > 0 ? styles.loss : perfStyles.muted}`}>
                          {s.lost > 0 ? `-${marksText(s.lost)}` : "-"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section className={styles.mapSection} aria-label="Answer map">
            <ol className={styles.map}>
              {current.questions.map((q) => (
                <li key={q.number}>
                  <button
                    type="button"
                    className={`${styles.cell} ${styles[q.status]}`}
                    onClick={() => jumpTo(q.number)}
                    aria-label={`Question ${q.number}: ${STATUS_LABEL[q.status]}`}
                    title={`Q${q.number}: ${STATUS_LABEL[q.status]}, ${signed(q.marksObtained)}`}
                  >
                    {q.number}
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <div className={styles.filters} role="tablist" aria-label="Show questions">
            {FILTERS.filter((f) => f === "all" || filterCount(f) > 0).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={`${styles.filter} ${filter === f ? styles.filterActive : ""}`}
                onClick={() => setFilter(f)}
              >
                {f !== "all" && <span className={`${styles.dot} ${styles[f]}`} aria-hidden="true" />}
                {f === "all" ? "All" : STATUS_LABEL[f]}
                <span className={styles.filterCount}>{filterCount(f)}</span>
              </button>
            ))}
          </div>

          <ol className={styles.questions}>
            {visible.map((q) => {
              const isOpen = open.has(q.number);
              const { given, key } = answerSummary(q);
              return (
                <li key={q.number} id={`transcript-q-${q.number}`} className={styles.question}>
                  <button
                    type="button"
                    className={styles.questionRow}
                    aria-expanded={isOpen}
                    onClick={() => toggle(q.number)}
                  >
                    <span className={`${styles.qNumber} ${styles[q.status]}`}>{q.number}</span>
                    <span className={styles.qText}>
                      <MathMLContent html={q.questionText} inline />
                    </span>
                    <span className={styles.qAnswer}>
                      {given === null ? (
                        <span className={perfStyles.muted}>Skipped</span>
                      ) : (
                        <span className={styles[`${q.status}Text`]}>{given}</span>
                      )}
                      {key !== null && q.status !== "correct" && <span className={styles.qKey}>Key {key}</span>}
                    </span>
                    <span
                      className={`${styles.qMarks} ${
                        q.marksObtained > 0 ? styles.gain : q.marksObtained < 0 ? styles.loss : perfStyles.muted
                      }`}
                    >
                      {signed(q.marksObtained)}
                    </span>
                    <ChevronDown size={16} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} aria-hidden="true" />
                  </button>
                  {isOpen && (
                    <div className={styles.detail}>
                      <TestResultQuestionRenderer
                        result={q}
                        questionNumber={q.number}
                        questionText={q.questionText}
                        paragraphText={q.paragraphText}
                        optionA={q.optionA}
                        optionB={q.optionB}
                        optionC={q.optionC}
                        optionD={q.optionD}
                        optionE={q.optionE}
                        viewer="teacher"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
};