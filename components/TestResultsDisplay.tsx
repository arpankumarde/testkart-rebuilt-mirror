import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { Progress } from './Progress';

import { TestResultQuestionRenderer, QuestionResultData } from './TestResultQuestionRenderer';
import styles from './TestResultsDisplay.module.css';

// Extended type that includes questions text and options, compatible with QuestionResultData
export interface ExtendedResultItem extends QuestionResultData {
  questionId: number;
  questionText: string;
  // questionType is inherited from QuestionResultData but we can narrow types if needed, 
  // though typically QuestionResultData's type is already correct.
  
  // Options for MCQs
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  optionE?: string | null;
  
  // Paragraph for comprehension
  paragraphText?: string | null;
  
  // Meta needed for stats
  isCorrect: boolean | null;
  // marksObtained is inherited from QuestionResultData
}

interface TestResultsDisplayProps {
  score: number;
  totalMarks: number;
  maxPossibleMarks: number;
  correctAnswers: number;
  totalQuestions: number;
  timeTaken: number;
  results: ExtendedResultItem[];
  showBackButton?: boolean;
}

export const TestResultsDisplay: React.FC<TestResultsDisplayProps> = ({
  score,
  totalMarks,
  maxPossibleMarks,
  correctAnswers,
  totalQuestions,
  timeTaken,
  results,
  showBackButton = true,
}) => {
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "0m 0s";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  // Derive attempt-level stats directly from per-question results so that
  // questions left unanswered are tracked separately instead of being
  // folded into "Incorrect". isCorrect is null for unattempted questions,
  // true for correct, and false for attempted-but-wrong (see
  // endpoints/student/test-attempts/latest-results_GET.ts).
  const incorrectAnswers = results.filter((r) => r.isCorrect === false).length;
  const notAttempted = results.filter((r) => r.isCorrect === null).length;
  const attemptedCount = totalQuestions - notAttempted;
  const isNegativeScore = score < 0;

  type QuestionStatus = 'correct' | 'incorrect' | 'unattempted';
  type FilterValue = 'all' | QuestionStatus;

  const getStatus = (r: ExtendedResultItem): QuestionStatus =>
    r.isCorrect === true ? 'correct' : r.isCorrect === false ? 'incorrect' : 'unattempted';

  const numberedResults = useMemo(
    () => results.map((r, index) => ({ result: r, questionNumber: index + 1, status: getStatus(r) })),
    [results]
  );

  const [filter, setFilter] = useState<FilterValue>('all');

  const visibleResults = useMemo(
    () => (filter === 'all' ? numberedResults : numberedResults.filter((r) => r.status === filter)),
    [numberedResults, filter]
  );

  const filterOptions: { value: FilterValue; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: totalQuestions },
    { value: 'correct', label: 'Correct', count: correctAnswers },
    { value: 'incorrect', label: 'Incorrect', count: incorrectAnswers },
    { value: 'unattempted', label: 'Not Attempted', count: notAttempted },
  ];

  const jumpToQuestion = (questionNumber: number) => {
    setFilter('all');
    // Filtering can change layout before the target renders; defer the
    // scroll to the next frame so scrollIntoView measures the final position.
    requestAnimationFrame(() => {
      document.getElementById(`question-${questionNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className={styles.resultsContainer}>
      {showBackButton && (
        <div className={styles.resultsHeader}>
          <Link to="/student/dashboard" className={styles.backLink}>
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
          <h1>Test Results</h1>
        </div>
      )}
      <div className={styles.scoreCard}>
        <h2>Your Score</h2>
        <p className={`${styles.scorePercentage} ${isNegativeScore ? styles.scoreNegative : ''}`}>
          {score.toFixed(2)}%
        </p>
        <p className={styles.scoreFraction}>
          {totalMarks.toFixed(2)} / {maxPossibleMarks} marks
        </p>
        <p className={styles.scoreSubtext}>
          {correctAnswers} / {totalQuestions} correct &middot; {attemptedCount} / {totalQuestions} attempted
        </p>
        <Progress value={Math.max(0, score)} className={styles.scoreProgress} />
      </div>
      <div className={styles.performanceBreakdown}>
        <div className={styles.breakdownItem}>
          <CheckCircle className={styles.correctIcon} />
          <div className={styles.breakdownText}>
            <p>{correctAnswers}</p>
            <span>Correct</span>
          </div>
        </div>
        <div className={styles.breakdownItem}>
          <XCircle className={styles.incorrectIcon} />
          <div className={styles.breakdownText}>
            <p>{incorrectAnswers}</p>
            <span>Incorrect</span>
          </div>
        </div>
        <div className={styles.breakdownItem}>
          <MinusCircle className={styles.notAttemptedIcon} />
          <div className={styles.breakdownText}>
            <p>{notAttempted}</p>
            <span>Not Attempted</span>
          </div>
        </div>
        <div className={styles.breakdownItem}>
          <Clock className={styles.timeIcon} />
          <div className={styles.breakdownText}>
            <p>{formatTime(timeTaken)}</p>
            <span>Time Taken</span>
          </div>
        </div>
        <div className={styles.breakdownItem}>
          <div className={styles.marksIcon}>M</div>
          <div className={styles.breakdownText}>
            <p>{totalMarks.toFixed(2)} / {maxPossibleMarks}</p>
            <span>Marks Obtained</span>
          </div>
        </div>
      </div>
      <div className={styles.reviewSection}>
        <div className={styles.stickyNav}>
          <div className={styles.filterRow}>
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.filterChip} ${filter === opt.value ? styles.filterChipActive : ''} ${styles[`filterChip_${opt.value}`]}`}
                onClick={() => setFilter(opt.value)}
                disabled={opt.count === 0}
                aria-pressed={filter === opt.value}
              >
                {opt.label} <span className={styles.filterChipCount}>{opt.count}</span>
              </button>
            ))}
          </div>
          <div className={styles.pillRow} role="navigation" aria-label="Jump to question">
            {numberedResults.map(({ questionNumber, status }) => (
              <button
                key={questionNumber}
                type="button"
                className={`${styles.pill} ${styles[`pill_${status}`]}`}
                onClick={() => jumpToQuestion(questionNumber)}
                title={`Question ${questionNumber} — ${status === 'correct' ? 'Correct' : status === 'incorrect' ? 'Incorrect' : 'Not Attempted'}`}
              >
                {questionNumber}
              </button>
            ))}
          </div>
        </div>
        <h3>Question Review</h3>
        {visibleResults.length === 0 ? (
          <p className={styles.noResultsText}>No questions match this filter.</p>
        ) : (
          visibleResults.map(({ result, questionNumber }) => (
            <TestResultQuestionRenderer
              key={result.questionId}
              id={`question-${questionNumber}`}
              result={result}
              questionNumber={questionNumber}
              questionText={result.questionText}
              paragraphText={result.paragraphText}
              optionA={result.optionA}
              optionB={result.optionB}
              optionC={result.optionC}
              optionD={result.optionD}
              optionE={result.optionE}
            />
          ))
        )}
      </div>
    </div>
  );
};