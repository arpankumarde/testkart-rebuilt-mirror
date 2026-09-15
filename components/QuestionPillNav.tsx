import React from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import styles from "./QuestionPillNav.module.css";

export interface QuestionPillNavItem {
  id: number;
}

interface QuestionPillNavProps {
  questions: QuestionPillNavItem[];
  // The id of the question currently being edited, or undefined when the
  // "new question" page is active (no existing question is selected).
  currentQuestionId?: number;
  getEditUrl: (questionId: number) => string;
  newQuestionUrl: string;
  isNewActive?: boolean;
  // Runs before navigation; calling preventDefault() keeps the teacher on the
  // page (used to confirm leaving with unsaved changes).
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

// Lets a teacher jump directly between any question in the subject, plus a
// trailing "+" pill to start a new one. Used by both the full-page question
// editor and the full-page "new question" flow.
export const QuestionPillNav: React.FC<QuestionPillNavProps> = ({
  questions,
  currentQuestionId,
  getEditUrl,
  newQuestionUrl,
  isNewActive,
  onNavigate,
}) => {
  if (questions.length === 0 && !isNewActive) {
    return null;
  }

  return (
    <nav className={styles.pillNav} aria-label="Jump to question">
      {questions.map((q, index) => {
        const isActive = q.id === currentQuestionId;
        return (
          <Link
            key={q.id}
            to={getEditUrl(q.id)}
            className={`${styles.pill} ${isActive ? styles.pillActive : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={isActive ? undefined : onNavigate}
          >
            {index + 1}
          </Link>
        );
      })}
      <Link
        to={newQuestionUrl}
        className={`${styles.pill} ${styles.pillAdd} ${isNewActive ? styles.pillActive : ""}`}
        title="Add a new question"
        aria-label="Add a new question"
        onClick={onNavigate}
      >
        <Plus size={14} />
      </Link>
    </nav>
  );
};
