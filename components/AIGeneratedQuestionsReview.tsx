import React from "react";
import { Check, AlertTriangle } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { MathMLContent } from "./MathMLContent";
import type { GeneratedQuestionDraft } from "../endpoints/teacher/questions/generate-ai_POST.schema";
import styles from "./AIGeneratedQuestionsReview.module.css";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;
type OptionKey = (typeof OPTION_KEYS)[number];

interface AIGeneratedQuestionsReviewProps {
  questions: GeneratedQuestionDraft[];
  /** Indices of the questions the teacher has kept selected. */
  selected: Set<number>;
  onToggle: (index: number) => void;
  onToggleAll: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** A generated question the teacher shouldn't accept blind — the AI left the answer out. */
export const isDraftMissingAnswer = (q: GeneratedQuestionDraft): boolean => {
  switch (q.questionType) {
    case "multiple_correct_mcq":
      return !q.correctOptions || q.correctOptions.length === 0;
    case "numerical":
      return q.numericalAnswer === null;
    default:
      return !q.correctOption;
  }
};

const optionText = (q: GeneratedQuestionDraft, key: OptionKey): string | null => {
  switch (key) {
    case "A":
      return q.optionA;
    case "B":
      return q.optionB;
    case "C":
      return q.optionC;
    case "D":
      return q.optionD;
  }
};

const isOptionCorrect = (q: GeneratedQuestionDraft, key: OptionKey): boolean =>
  q.questionType === "multiple_correct_mcq"
    ? !!q.correctOptions?.includes(key)
    : q.correctOption === key;

export const AIGeneratedQuestionsReview = ({
  questions,
  selected,
  onToggle,
  onToggleAll,
  disabled,
  className,
}: AIGeneratedQuestionsReviewProps) => {
  const allSelected = questions.length > 0 && selected.size === questions.length;

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {selected.size} of {questions.length} selected
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onToggleAll(!allSelected)}
        >
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
      </div>

      <div className={styles.list}>
        {questions.map((q, index) => {
          const isSelected = selected.has(index);
          const missingAnswer = isDraftMissingAnswer(q);

          return (
            <div
              key={index}
              className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
            >
              <label className={styles.selectControl}>
                <Checkbox
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => onToggle(index)}
                  aria-label={`Include question ${index + 1}`}
                />
              </label>

              <div className={styles.body}>
                <div className={styles.metaRow}>
                  <strong>Q{index + 1}</strong>
                  {missingAnswer && (
                    <Badge variant="warning" className={styles.warnBadge}>
                      <AlertTriangle size={12} /> No answer marked
                    </Badge>
                  )}
                </div>

                <MathMLContent html={q.questionText} className={styles.questionText} />

                {q.questionType === "numerical" ? (
                  <div className={styles.numericalAnswer}>
                    <Check size={14} /> Answer: {q.numericalAnswer ?? "—"}
                    {q.numericalTolerance ? ` (± ${q.numericalTolerance})` : ""}
                  </div>
                ) : (
                  <div className={styles.options}>
                    {OPTION_KEYS.map((key) => {
                      const text = optionText(q, key);
                      if (text === null) return null;
                      const correct = isOptionCorrect(q, key);
                      return (
                        <div
                          key={key}
                          className={`${styles.option} ${correct ? styles.optionCorrect : ""}`}
                        >
                          <span className={styles.optionKey}>
                            {correct ? <Check size={12} /> : key}
                          </span>
                          <MathMLContent html={text} inline />
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.explanation && (
                  <details className={styles.explanation}>
                    <summary>Explanation</summary>
                    <MathMLContent html={q.explanation} />
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
