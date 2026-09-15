import React from 'react';
import { QuestionData, QuestionAnswer, MCQOption } from '../helpers/questionAnswerTypes';
import { QuestionSingleCorrectMCQ } from './QuestionSingleCorrectMCQ';
import { QuestionMultipleCorrectMCQ } from './QuestionMultipleCorrectMCQ';
import { QuestionNumerical } from './QuestionNumerical';
import { QuestionAssertionReason } from './QuestionAssertionReason';
import { QuestionComprehension } from './QuestionComprehension';
import { QuestionMatchTheFollowing } from './QuestionMatchTheFollowing';
import { parseStoredMatchData } from '../helpers/testScoringLogic';
import styles from './QuestionRenderer.module.css';

interface QuestionRendererProps {
  question: QuestionData;
  answer: QuestionAnswer | undefined;
  onAnswerChange: (answer: QuestionAnswer | undefined) => void;
  className?: string;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  answer,
  onAnswerChange,
  className,
}) => {
  const questionType = question.questionType || 'single_correct_mcq';

  // Handlers for different question types
  const handleSingleChange = (value: MCQOption) => {
    onAnswerChange({ type: 'single', value });
  };

  const handleMultipleChange = (value: MCQOption[]) => {
    if (value.length === 0) {
      onAnswerChange(undefined);
    } else {
      onAnswerChange({ type: 'multiple', value });
    }
  };

  const handleNumericalChange = (value: number | undefined) => {
    if (value === undefined) {
      onAnswerChange(undefined);
    } else {
      onAnswerChange({ type: 'numerical', value });
    }
  };

  const handleMatchChange = (value: Record<string, string>) => {
    if (Object.keys(value).length === 0) {
      onAnswerChange(undefined);
    } else {
      onAnswerChange({ type: 'match', value });
    }
  };

  // Render based on question type
  switch (questionType) {
    case 'single_correct_mcq':
      return (
        <QuestionSingleCorrectMCQ
          questionId={question.id}
          optionA={question.optionA || ''}
          optionB={question.optionB || ''}
          optionC={question.optionC || ''}
          optionD={question.optionD || ''}
          optionE={question.optionE || ''}
          selectedOption={answer?.type === 'single' ? answer.value : undefined}
          onAnswerChange={handleSingleChange}
          className={className}
        />
      );

    case 'multiple_correct_mcq':
      return (
        <QuestionMultipleCorrectMCQ
          questionId={question.id}
          optionA={question.optionA || ''}
          optionB={question.optionB || ''}
          optionC={question.optionC || ''}
          optionD={question.optionD || ''}
          optionE={question.optionE || ''}
          selectedOptions={answer?.type === 'multiple' ? answer.value : []}
          onAnswerChange={handleMultipleChange}
          className={className}
        />
      );

    case 'numerical':
      return (
        <QuestionNumerical
          questionId={question.id}
          currentAnswer={answer?.type === 'numerical' ? answer.value : undefined}
          onAnswerChange={handleNumericalChange}
          className={className}
        />
      );

    case 'assertion_reason':
      return (
        <QuestionAssertionReason
          questionId={question.id}
          optionA={question.optionA || ''}
          optionB={question.optionB || ''}
          optionC={question.optionC || ''}
          optionD={question.optionD || ''}
          optionE={question.optionE || ''}
          selectedOption={answer?.type === 'single' ? answer.value : undefined}
          onAnswerChange={handleSingleChange}
          className={className}
        />
      );

    case 'comprehension':
      return (
        <QuestionComprehension
          questionId={question.id}
          paragraphText={question.paragraphText || ''}
          optionA={question.optionA || ''}
          optionB={question.optionB || ''}
          optionC={question.optionC || ''}
          optionD={question.optionD || ''}
          optionE={question.optionE || ''}
          selectedOption={answer?.type === 'single' ? answer.value : undefined}
          onAnswerChange={handleSingleChange}
          className={className}
        />
      );

    case 'match_the_following': {
      const matchData = parseStoredMatchData(question.matchData);
      if (!matchData) {
        return (
          <div className={styles.error}>
            Match data is missing for this question.
          </div>
        );
      }
      return (
        <QuestionMatchTheFollowing
          questionId={question.id}
          matchData={matchData}
          currentMatches={answer?.type === 'match' ? answer.value : {}}
          onAnswerChange={handleMatchChange}
          className={className}
        />
      );
    }

    default:
      return (
        <div className={styles.error}>
          Unknown question type: {questionType}
        </div>
      );
  }
};