import React from "react";
import { Check, AlertCircle } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { MathMLContent } from "./MathMLContent";
import { getMatchAnswerRows } from "../helpers/testScoringLogic";
import { useAdminPreviewQuestions } from "../helpers/useAdminContentPreview";
import { PreviewQuestion } from "../endpoints/admin/content-preview/questions_GET.schema";
import styles from "./AdminPreviewQuestions.module.css";

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;

const TYPE_LABELS: Record<string, string> = {
  single_correct_mcq: "Single correct",
  multiple_correct_mcq: "Multiple correct",
  numerical: "Numerical",
  assertion_reason: "Assertion and reason",
  comprehension: "Comprehension",
  match_the_following: "Match the following",
};

const formatMarks = (q: PreviewQuestion) => {
  const plus = q.positiveMarks ?? 1;
  const minus = q.negativeMarks ?? 0;
  return minus > 0 ? `+${plus} / -${minus}` : `+${plus}`;
};

const Options = ({ question }: { question: PreviewQuestion }) => {
  const correct =
    question.questionType === "multiple_correct_mcq"
      ? new Set(question.correctOptions ?? [])
      : new Set(question.correctOption ? [question.correctOption] : []);
  const options = OPTION_KEYS.filter((key) => {
    const text = question[`option${key}` as const];
    return key !== "E" ? true : !!text;
  });
  return (
    <ol className={styles.options}>
      {options.map((key) => {
        const isCorrect = correct.has(key);
        return (
          <li key={key} className={`${styles.option} ${isCorrect ? styles.optionCorrect : ""}`}>
            <span className={styles.optionKey}>{key}</span>
            <MathMLContent html={question[`option${key}` as const] ?? ""} className={styles.optionText} />
            {isCorrect && (
              <span className={styles.correctTag}>
                <Check size={14} aria-hidden="true" />
                Correct
              </span>
            )}
          </li>
        );
      })}
      {correct.size === 0 && <li className={styles.warningLine}>No correct option is set.</li>}
    </ol>
  );
};

const MatchTable = ({ question }: { question: PreviewQuestion }) => {
  const rows = getMatchAnswerRows(question.matchData, null);
  if (rows.length === 0) return <p className={styles.warningLine}>No match items are set.</p>;
  return (
    <table className={styles.matchTable}>
      <thead>
        <tr>
          <th>Item</th>
          <th>Correct match</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.leftIndex}>
            <td>
              {row.leftIndex + 1}. <MathMLContent html={row.leftText} inline />
            </td>
            <td>
              {row.correctRightIndex === null ? (
                <em className={styles.warningInline}>No key set</em>
              ) : (
                <>
                  {String.fromCharCode(65 + row.correctRightIndex)}. <MathMLContent html={row.correctText ?? ""} inline />
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Answer = ({ question }: { question: PreviewQuestion }) => {
  if (question.questionType === "numerical") {
    return question.numericalAnswer === null ? (
      <p className={styles.warningLine}>No answer is set.</p>
    ) : (
      <p className={styles.numerical}>
        <span className={styles.correctTag}>
          <Check size={14} aria-hidden="true" />
          Answer
        </span>
        {question.numericalAnswer}
        {question.numericalTolerance ? ` (plus or minus ${question.numericalTolerance})` : ""}
      </p>
    );
  }
  if (question.questionType === "match_the_following") return <MatchTable question={question} />;
  return <Options question={question} />;
};

export const AdminPreviewQuestions = ({ testItemId }: { testItemId: number }) => {
  const { data, isFetching, isError, error, refetch } = useAdminPreviewQuestions(testItemId, true);

  if (isFetching && !data) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} style={{ height: "7rem", width: "100%" }} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorRow} role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        <span>{error instanceof Error ? error.message : "Could not load the questions."}</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const questions = data?.questions ?? [];
  if (questions.length === 0) return <p className={styles.empty}>This test has no questions yet.</p>;

  return (
    <ol className={styles.list}>
      {questions.map((question, index) => {
        const previous = questions[index - 1];
        const showSubject = !!question.subjectName && question.subjectName !== previous?.subjectName;
        const showPassage = !!question.paragraphText && question.paragraphText !== previous?.paragraphText;
        return (
          <li key={question.id} className={styles.item}>
            {showSubject && <h4 className={styles.subject}>{question.subjectName}</h4>}
            {showPassage && (
              <div className={styles.passage}>
                <span className={styles.label}>Passage</span>
                <MathMLContent html={question.paragraphText} />
              </div>
            )}
            <article className={styles.card}>
              <header className={styles.cardHeader}>
                <span className={styles.number}>Q{index + 1}</span>
                <Badge variant="outline">{TYPE_LABELS[question.questionType] ?? question.questionType}</Badge>
                <span className={styles.marks}>{formatMarks(question)}</span>
                {question.isAiGenerated && <Badge variant="secondary">AI generated</Badge>}
              </header>
              <MathMLContent html={question.questionText} className={styles.questionText} />
              <Answer question={question} />
              <div className={styles.explanation}>
                <span className={styles.label}>Explanation</span>
                {question.explanation ? (
                  <MathMLContent html={question.explanation} />
                ) : (
                  <p className={styles.muted}>No explanation added.</p>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
};