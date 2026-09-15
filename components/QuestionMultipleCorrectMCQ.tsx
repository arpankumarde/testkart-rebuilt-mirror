import React from 'react';
import { Checkbox } from './Checkbox';
import { MathMLContent } from './MathMLContent';
import { MCQOption } from '../helpers/questionAnswerTypes';
import styles from './QuestionMultipleCorrectMCQ.module.css';

interface QuestionMultipleCorrectMCQProps {
  questionId: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string;
  selectedOptions: MCQOption[];
  onAnswerChange: (value: MCQOption[]) => void;
  className?: string;
}

export const QuestionMultipleCorrectMCQ: React.FC<QuestionMultipleCorrectMCQProps> = ({
  questionId,
  optionA,
  optionB,
  optionC,
  optionD,
  optionE,
  selectedOptions,
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

  const handleCheckboxChange = (option: MCQOption, checked: boolean) => {
    if (checked) {
      onAnswerChange([...selectedOptions, option]);
    } else {
      onAnswerChange(selectedOptions.filter(opt => opt !== option));
    }
  };

  return (
    <div className={`${styles.optionsGroup} ${className || ''}`}>
      <p className={styles.instruction}>Select all correct options:</p>
      {optionKeys.map((opt) => {
        const optionText = optionMap[opt];
        const isChecked = selectedOptions.includes(opt);
        
        return (
          <label key={opt} className={styles.optionLabel}>
            <Checkbox
              id={`q${questionId}-opt${opt}`}
              checked={isChecked}
              onChange={(e) => handleCheckboxChange(opt, e.target.checked)}
            />
            <MathMLContent html={optionText} inline />
          </label>
        );
      })}
    </div>
  );
};