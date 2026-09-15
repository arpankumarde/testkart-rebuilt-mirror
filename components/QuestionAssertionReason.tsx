import React from 'react';
import { RadioGroup, RadioGroupItem } from './RadioGroup';
import { MathMLContent } from './MathMLContent';
import { MCQOption } from '../helpers/questionAnswerTypes';
import styles from './QuestionAssertionReason.module.css';

interface QuestionAssertionReasonProps {
  questionId: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string;
  selectedOption?: MCQOption;
  onAnswerChange: (value: MCQOption) => void;
  className?: string;
}

export const QuestionAssertionReason: React.FC<QuestionAssertionReasonProps> = ({
  questionId,
  optionA,
  optionB,
  optionC,
  optionD,
  optionE,
  selectedOption,
  onAnswerChange,
  className,
}) => {
  const optionKeys = React.useMemo(() => {
    const keys: MCQOption[] = ['A', 'B', 'C', 'D'];
    if (optionE) keys.push('E');
    return keys;
  }, [optionE]);

  const optionMap: Record<string, string> = { A: optionA, B: optionB, C: optionC, D: optionD };
  if (optionE) optionMap.E = optionE;

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <p className={styles.instruction}>
        Select the correct relationship between the assertion and reason:
      </p>
      <RadioGroup
        key={selectedOption || 'cleared'}
        className={styles.optionsGroup}
        value={selectedOption}
        onValueChange={(value) => onAnswerChange(value as MCQOption)}
      >
        {optionKeys.map((opt) => {
          const optionText = optionMap[opt];
          return (
            <label key={opt} className={styles.optionLabel}>
              <RadioGroupItem value={opt} id={`q${questionId}-opt${opt}`} />
              <MathMLContent html={optionText} inline />
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
};