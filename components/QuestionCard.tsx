import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { MathMLContent } from "./MathMLContent";
import { Edit, Trash2, Sparkles, ArrowRightLeft, Check, AlertTriangle, Clock } from "lucide-react";
import { Selectable } from "kysely";
import { TestQuestions } from "../helpers/schema";
import { getMatchAnswerRows } from "../helpers/testScoringLogic";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Dialog";
import { QuestionForm } from "./QuestionForm";
import styles from "./QuestionCard.module.css";

interface QuestionCardProps {
  question: Selectable<TestQuestions>;
  index: number;
  testId?: number;
  itemId?: number;
  subjectId: number;
  onDelete: (id: number) => void;
  onUpdateSuccess: () => void;
  isDeleting?: boolean;
  sections?: Array<{ id: number; sectionName: string }>;
  onMoveToSection?: (sectionId: number | null) => void;
  questionWiseTiming?: boolean;
}

export const QuestionCard = ({
  question: q,
  index,
  testId,
  itemId,
  subjectId,
  onDelete,
  onUpdateSuccess,
  isDeleting,
  sections,
  onMoveToSection,
  questionWiseTiming,
}: QuestionCardProps) => {
  const getQuestionTypeBadge = (type: string) => {
    switch (type) {
      case "multiple_correct_mcq":
        return "Multi MCQ";
      case "numerical":
        return "Numerical";
      case "assertion_reason":
        return "Assertion-Reason";
      case "comprehension":
        return "Comprehension";
      case "match_the_following":
        return "Match";
      case "single_correct_mcq":
      default:
        return "MCQ";
    }
  };

  const isOptionCorrect = (option: string) => {
    if (q.questionType === "multiple_correct_mcq") {
      return (
        Array.isArray(q.correctOptions) && q.correctOptions.includes(option)
      );
    }
    return q.correctOption === option;
  };

  const matchRows =
    q.questionType === "match_the_following" ? getMatchAnswerRows(q.matchData, {}) : [];

  // Surfaces the same "incomplete question" states the review step would
  // otherwise block publish on, right here where the teacher is editing.
  const isMissingAnswer = (): boolean => {
    switch (q.questionType) {
      case "multiple_correct_mcq":
        return !Array.isArray(q.correctOptions) || q.correctOptions.length === 0;
      case "numerical":
        return q.numericalAnswer === null || q.numericalAnswer === undefined;
      case "match_the_following":
        return matchRows.length === 0 || matchRows.some((row) => row.correctRightIndex === null);
      default:
        return !q.correctOption;
    }
  };
  const missingAnswer = isMissingAnswer();

  return (
    <div className={`${styles.questionCard} ${missingAnswer ? styles.questionCardWarning : ""}`}>
      <div className={styles.questionHeader}>
        <div className={styles.questionText}>
          <div className={styles.questionMetaRow}>
            <strong>Q{index + 1}:</strong>{" "}
            <Badge variant="outline" className={styles.typeBadge}>
              {getQuestionTypeBadge(q.questionType ?? "single_correct_mcq")}
            </Badge>
            <span className={styles.marksBadge}>
              +{q.positiveMarks ?? 4} / -{String(q.negativeMarks ?? 0).replace(/^-/, "")}
            </span>
            {q.isAiGenerated && (
              <span className={styles.aiBadge}>
                <Sparkles size={12} />
                AI Generated
              </span>
            )}
            {questionWiseTiming && q.durationSeconds != null && (
              <span className={styles.durationBadge}>
                <Clock size={12} aria-hidden="true" /> {q.durationSeconds}s
              </span>
            )}
            {missingAnswer && (
              <span className={styles.warningBadge}>
                <AlertTriangle size={12} />
                {q.questionType === "match_the_following" ? "Match key incomplete" : "No correct answer marked"}
              </span>
            )}
          </div>

          {q.questionType === "comprehension" && q.paragraphText && (
            <div className={styles.comprehensionBox}>
              <div className={styles.passageLabel}>Passage</div>
              <MathMLContent html={q.paragraphText} />
            </div>
          )}

          <div className={styles.questionContent}>
            <MathMLContent html={q.questionText} />
          </div>
        </div>
        <div className={styles.questionActions}>
          {testId != null && itemId != null ? (
            <Button variant="ghost" size="icon-sm" asChild title="Edit question">
              <Link
                to={`/teacher/create-test/${testId}/test-items/${itemId}/questions/${q.id}/edit?subjectId=${subjectId}`}
              >
                <Edit size={16} />
              </Link>
            </Button>
          ) : (
            <EditQuestionDialog
              subjectId={subjectId}
              questionToEdit={q}
              onSuccess={onUpdateSuccess}
              sections={sections}
              questionWiseTiming={questionWiseTiming}
            />
          )}
          {sections && sections.length > 0 && onMoveToSection && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" title="Move to Section">
                  <ArrowRightLeft size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Move to Section</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sections.map((section) => (
                  <DropdownMenuItem
                    key={section.id}
                    onClick={() => onMoveToSection(section.id)}
                    disabled={q.sectionId === section.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{section.sectionName}</span>
                    {q.sectionId === section.id && <Check size={14} />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onMoveToSection(null)}
                  disabled={q.sectionId === null || q.sectionId === undefined}
                >
                  Remove from section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(q.id)}
            disabled={isDeleting}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {q.questionType === "numerical" ? (
        <div className={styles.numericalAnswer}>
          <div className={styles.correct}>
            <strong>Answer:</strong> {q.numericalAnswer}
            {Number(q.numericalTolerance) > 0 && (
              <span> (± {q.numericalTolerance})</span>
            )}
          </div>
        </div>
      ) : q.questionType === "match_the_following" ? (
        <div className={styles.matchTableContainer}>
          {matchRows.length > 0 && (
            <table className={styles.matchTable}>
              <thead>
                <tr>
                  <th>Column A</th>
                  <th>Correct match</th>
                </tr>
              </thead>
              <tbody>
                {matchRows.map((row) => (
                  <tr key={row.leftIndex}>
                    <td>
                      {row.leftIndex + 1}. <MathMLContent html={row.leftText} inline />
                    </td>
                    <td>
                      {row.correctRightIndex === null ? (
                        <em>Not set</em>
                      ) : (
                        <>
                          {String.fromCharCode(65 + row.correctRightIndex)}.{" "}
                          <MathMLContent html={row.correctText ?? ""} inline />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className={styles.optionsGrid}>
          <div className={isOptionCorrect("A") ? styles.correct : ""}>
            <strong>A.</strong> <MathMLContent html={q.optionA} />
          </div>
          <div className={isOptionCorrect("B") ? styles.correct : ""}>
            <strong>B.</strong> <MathMLContent html={q.optionB} />
          </div>
          <div className={isOptionCorrect("C") ? styles.correct : ""}>
            <strong>C.</strong> <MathMLContent html={q.optionC} />
          </div>
          <div className={isOptionCorrect("D") ? styles.correct : ""}>
            <strong>D.</strong> <MathMLContent html={q.optionD} />
          </div>
          {q.optionE && (
            <div className={isOptionCorrect("E") ? styles.correct : ""}>
              <strong>E.</strong> <MathMLContent html={q.optionE} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const EditQuestionDialog = ({
  subjectId,
  questionToEdit,
  onSuccess,
  sections,
  questionWiseTiming,
}: {
  subjectId: number;
  questionToEdit?: Selectable<TestQuestions>;
  onSuccess: () => void;
  sections?: Array<{ id: number; sectionName: string }>;
  questionWiseTiming?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <Edit size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>
        <QuestionForm
          subjectId={subjectId}
          questionToEdit={questionToEdit}
          onSuccess={() => {
            onSuccess();
            setIsOpen(false);
          }}
          sections={sections}
          questionWiseTiming={questionWiseTiming}
        />
      </DialogContent>
    </Dialog>
  );
};