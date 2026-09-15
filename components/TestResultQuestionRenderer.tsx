import React, { useState } from 'react';
import { Badge } from './Badge';
import { MathMLContent } from './MathMLContent';
import { Check, X, ChevronDown } from 'lucide-react';
import { getMatchAnswerRows } from '../helpers/testScoringLogic';
import styles from './TestResultQuestionRenderer.module.css';

// Self-contained interface for the renderer
export interface QuestionResultData {
  questionType: 'single_correct_mcq' | 'multiple_correct_mcq' | 'numerical' | 'assertion_reason' | 'comprehension' | 'match_the_following';
  marksObtained: number;
  
  // Single Choice / Assertion Reason / Comprehension
  correctOption?: string | null;
  selectedOption?: string | null;
  
  // Multiple Choice
  correctOptions?: string[] | null;
  selectedOptions?: string[] | null;
  
  // Numerical
  correctNumericalAnswer?: number | null;
  studentNumericalAnswer?: number | null;
  numericalTolerance?: number | null;
  
  // Match the Following
  matchData?: {
    leftItems?: string[];
    rightItems?: string[];
    correctMatches: Record<string, string>;
  } | null;
  matchAnswers?: Record<string, string> | null;
  
  // Common
  explanation?: string | null;
}

interface TestResultQuestionRendererProps {
  result: QuestionResultData;
  questionNumber: number;
  questionText: string;
  paragraphText?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  optionE?: string | null;
  id?: string;
}

export const TestResultQuestionRenderer: React.FC<TestResultQuestionRendererProps> = ({
  result,
  questionNumber,
  questionText,
  paragraphText,
  optionA,
  optionB,
  optionC,
  optionD,
  optionE,
  id,
}) => {
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  const renderMarks = () => {
    const marks = result.marksObtained;
    let marksClass = styles.marksZero;
    let marksText = `0 marks`;

    if (marks > 0) {
      marksClass = styles.marksPositive;
      marksText = `+${marks} marks`;
    } else if (marks < 0) {
      marksClass = styles.marksNegative;
      marksText = `${marks} marks`;
    }

    return <span className={marksClass}>{marksText}</span>;
  };

  const renderSingleChoiceQuestion = () => {
    const options: Record<string, string | null | undefined> = {
      A: optionA,
      B: optionB,
      C: optionC,
      D: optionD,
    };
    
    if (optionE) {
      options.E = optionE;
    }

    return (
      <>
        <div className={styles.reviewOptions}>
          {Object.entries(options).map(([key, text]) => {
            const isSelected = result.selectedOption === key;
            const isCorrect = result.correctOption === key;

            let variant: 'success' | 'destructive' | 'outline' = 'outline';

            if (isCorrect) {
              variant = 'success';
            } else if (isSelected && !isCorrect) {
              variant = 'destructive';
            }

            return (
              <Badge key={key} variant={variant} className={styles.reviewOptionBadge}>
                <span>{key}: </span>
                <span style={{ marginLeft: '0.25rem' }}>
                  <MathMLContent html={text} inline />
                </span>
              </Badge>
            );
          })}
        </div>
        {result.selectedOption === null && (
          <div className={styles.unattemptedNotice}>
            <strong>Not Attempted:</strong> This question was not answered.
          </div>
        )}
        <div className={styles.correctAnswer}>
          <strong>Correct Answer:</strong> {result.correctOption}:{' '}
          <span style={{ marginLeft: '0.25rem' }}>
            <MathMLContent
              html={options[result.correctOption as keyof typeof options] || ''}
              inline
            />
          </span>
        </div>
      </>
    );
  };

  const renderMultipleChoiceQuestion = () => {
    const options: Record<string, string | null | undefined> = {
      A: optionA,
      B: optionB,
      C: optionC,
      D: optionD,
    };
    
    if (optionE) {
      options.E = optionE;
    }

    const correctOptions = result.correctOptions || [];
    const selectedOptions = result.selectedOptions || [];

    return (
      <>
        <div className={styles.reviewOptions}>
          {Object.entries(options).map(([key, text]) => {
            const isCorrect = correctOptions.includes(key);
            const isSelected = selectedOptions.includes(key);

            let variant: 'success' | 'destructive' | 'outline' = 'outline';

            if (isCorrect && isSelected) {
              variant = 'success';
            } else if (isSelected && !isCorrect) {
              variant = 'destructive';
            } else if (isCorrect) {
              variant = 'success';
            }

            return (
              <Badge key={key} variant={variant} className={styles.reviewOptionBadge}>
                {isSelected && <Check size={16} className={styles.checkIcon} />}
                <span>{key}: </span>
                <span style={{ marginLeft: '0.25rem' }}>
                  <MathMLContent html={text} inline />
                </span>
              </Badge>
            );
          })}
        </div>
        {selectedOptions.length === 0 && (
          <div className={styles.unattemptedNotice}>
            <strong>Not Attempted:</strong> This question was not answered.
          </div>
        )}
        <div className={styles.correctAnswer}>
          <strong>Correct Options:</strong> {correctOptions.join(', ')}
        </div>
      </>
    );
  };

  const renderNumericalQuestion = () => {
    const studentAnswer = result.studentNumericalAnswer;
    const correctAnswer = result.correctNumericalAnswer;
    const tolerance = result.numericalTolerance;

    return (
      <>
        <div className={styles.numericalAnswer}>
          <div className={styles.answerRow}>
            <strong>Your Answer:</strong>{' '}
            {studentAnswer !== null ? studentAnswer : 'Not Attempted'}
          </div>
          {studentAnswer === null && (
            <div className={styles.unattemptedNotice}>
              <strong>Not Attempted:</strong> This question was not answered.
            </div>
          )}
        </div>
        <div className={styles.correctAnswer}>
          <strong>Correct Answer:</strong> {correctAnswer}
          {tolerance != null && tolerance > 0 && ` (±${tolerance})`}
        </div>
      </>
    );
  };

  const renderMatchQuestion = () => {
    const rows = getMatchAnswerRows(result.matchData, result.matchAnswers).filter(
      (row) => row.correctRightIndex !== null || row.studentRightIndex !== null
    );
    const notAttempted = rows.every((row) => row.studentRightIndex === null);
    const letter = (index: number | null) => (index === null ? '' : `${String.fromCharCode(65 + index)}. `);

    return (
      <>
        <div className={styles.matchTable}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Your Match</th>
                <th>Correct Match</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.leftIndex}>
                  <td className={styles.matchKey}>
                    {row.leftIndex + 1}. <MathMLContent html={row.leftText} inline />
                  </td>
                  <td className={row.isCorrect ? styles.matchCorrect : styles.matchWrong}>
                    {row.studentRightIndex === null ? (
                      <em>Not answered</em>
                    ) : (
                      <>
                        {letter(row.studentRightIndex)}
                        <MathMLContent html={row.studentText ?? ''} inline />
                      </>
                    )}
                  </td>
                  <td className={styles.matchCorrectAnswer}>
                    {row.correctRightIndex === null ? (
                      <em>No key set</em>
                    ) : (
                      <>
                        {letter(row.correctRightIndex)}
                        <MathMLContent html={row.correctText ?? ''} inline />
                      </>
                    )}
                  </td>
                  <td>
                    {row.isCorrect ? (
                      <Check size={20} className={styles.correctIcon} aria-label="Correct" />
                    ) : (
                      <X size={20} className={styles.incorrectIcon} aria-label="Incorrect" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {notAttempted && (
          <div className={styles.unattemptedNotice}>
            <strong>Not Attempted:</strong> This question was not answered.
          </div>
        )}
      </>
    );
  };

  const renderQuestionContent = () => {
    switch (result.questionType) {
      case 'single_correct_mcq':
      case 'assertion_reason':
      case 'comprehension':
        return renderSingleChoiceQuestion();
      case 'multiple_correct_mcq':
        return renderMultipleChoiceQuestion();
      case 'numerical':
        return renderNumericalQuestion();
      case 'match_the_following':
        return renderMatchQuestion();
      default:
        // Fallback for safety - should never reach here with proper question types
        return renderSingleChoiceQuestion();
    }
  };

  return (
    <div className={styles.reviewItem} id={id}>
      {paragraphText && (
        <div className={styles.paragraphText}>
          <strong>Passage:</strong>
          <div style={{ marginTop: '0.5rem' }}>
            <MathMLContent html={paragraphText} />
          </div>
        </div>
      )}
      <h4 className={styles.reviewQuestionText}>
        <span className={styles.questionNumber}>{questionNumber}.</span>
        <div style={{ flex: 1 }}>
          <MathMLContent html={questionText} />
        </div>
        {renderMarks()}
      </h4>
      {renderQuestionContent()}
      <button
        type="button"
        className={styles.explanationToggle}
        onClick={() => setIsExplanationOpen((prev) => !prev)}
        aria-expanded={isExplanationOpen}
      >
        <span>{isExplanationOpen ? 'Hide Explanation' : 'Show Explanation'}</span>
        <ChevronDown
          size={16}
          className={`${styles.explanationChevron} ${isExplanationOpen ? styles.explanationChevronOpen : ''}`}
        />
      </button>
      {isExplanationOpen && (
        <div className={styles.explanation}>
          <strong>Explanation:</strong>
          <div style={{ marginTop: '0.5rem' }}>
            <MathMLContent
              html={result.explanation || 'No explanation available for this question.'}
            />
          </div>
        </div>
      )}
    </div>
  );
};