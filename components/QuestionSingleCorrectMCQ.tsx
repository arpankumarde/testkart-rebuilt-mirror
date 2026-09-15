import React from 'react';
import { RadioGroup, RadioGroupItem } from './RadioGroup';
import { MathMLContent } from './MathMLContent';
import { MCQOption } from '../helpers/questionAnswerTypes';
import styles from './QuestionSingleCorrectMCQ.module.css';

interface QuestionSingleCorrectMCQProps {
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

export const QuestionSingleCorrectMCQ: React.FC<QuestionSingleCorrectMCQProps> = ({
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
    <RadioGroup
      key={selectedOption || 'cleared'}
      className={`${styles.optionsGroup} ${className || ''}`}
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
  );
};